import { useState, useEffect } from 'react';
import { View, Text, FlatList, SectionList, Image, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Switch, ScrollView, TextInput } from 'react-native';
import { collection, getDocs, getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../config/firebase';
import { Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, calculateDistance, formatDistance, sortByDistance, isValidLocation, normalizeLocation } from '../../utils/location';
import { quickNavigateToGoogleMaps } from '../../utils/navigation';
import NearbyShopsMap from '../../components/NearbyShopsMap';
import DebugShopData from '../../components/DebugShopData';
import { useCart } from '../../context/CartProvider';
import Toast from 'react-native-toast-message';

// Define the Product type
type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  unit: string;
  shopId: string;
  type?: string;
  farmerId?: string;
};

// Define the Shop type
type Shop = {
  id: string;
  name: string;
  farmerId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
};

// Define the GroupedProduct type for SectionList
type GroupedProduct = {
  title: string;
  shopId: string;
  shopInfo: Shop;
  data: ProductWithDistance[];
};

// Define the ProductWithDistance type
type ProductWithDistance = Product & {
  distance?: number;
  shopName?: string;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<ProductWithDistance[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [filterByDistance, setFilterByDistance] = useState(false);
  const [maxDistance, setMaxDistance] = useState(10); // 10 km default
  const [showMap, setShowMap] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [showDebug, setShowDebug] = useState(false); // Add debug toggle
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped'); // New view mode state
  const [searchQuery, setSearchQuery] = useState<string>(''); // Search functionality
  const [showDistanceModal, setShowDistanceModal] = useState(false); // Distance selection modal
  const { addToCart } = useCart();
  const db = getFirestore(app);

  useEffect(() => {
    const initializeLocation = async () => {
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setLocationEnabled(true);
      }
    };
    initializeLocation();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Check if cached data exists
        const cachedProducts = await AsyncStorage.getItem('products');
        if (cachedProducts) {
          const parsedProducts: ProductWithDistance[] = JSON.parse(cachedProducts);
          setProducts(parsedProducts);
        }

        // Fetch fresh data from Firestore
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productsData: ProductWithDistance[] = [];
        const shopsData: any[] = [];
        
        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          const product: ProductWithDistance = {
            id: docSnap.id,
            name: data.name || 'No Name',
            price: data.price || 0,
            image: data.image || 'https://via.placeholder.com/150',
            unit: data.unit || '',
            shopId: data.shopId || '',
            type: data.type || '',
            farmerId: data.farmerId || '',
          };

          // Fetch shop details if shopId exists
          if (data.shopId) {
            try {
              const shopRef = doc(db, 'shops', data.shopId);
              const shopSnap = await getDoc(shopRef);
              
              if (shopSnap.exists()) {
                const shopData = shopSnap.data();
                product.shopName = shopData.name || 'Unknown Shop';
                
                // Check if location data is valid before processing
                const isValidLocationData = isValidLocation(shopData.location);
                const normalizedLocation = normalizeLocation(shopData.location);
                
                // Add shop to shops array if not already added and has valid location
                const existingShop = shopsData.find(shop => shop.id === data.shopId);
                if (!existingShop && isValidLocationData && normalizedLocation) {
                  shopsData.push({
                    id: data.shopId,
                    name: shopData.name,
                    location: normalizedLocation,
                    distance: currentLocation ? calculateDistance(
                      currentLocation.latitude,
                      currentLocation.longitude,
                      normalizedLocation.latitude,
                      normalizedLocation.longitude
                    ) : undefined
                  });
                }
                
                // Calculate distance if user location is available and shop has valid location
                if (currentLocation && isValidLocationData && normalizedLocation) {
                  product.distance = calculateDistance(
                    currentLocation.latitude,
                    currentLocation.longitude,
                    normalizedLocation.latitude,
                    normalizedLocation.longitude
                  );
                }
              }
            } catch (shopError) {
              console.error('Error fetching shop details:', shopError);
            }
          }

          productsData.push(product);
        }

        // Sort by distance if location is available
        const sortedProducts = currentLocation ? sortByDistance(productsData) : productsData;
        
        // Update state and cache the data
        setProducts(sortedProducts);
        setShops(shopsData);
        groupProductsByShop(sortedProducts, shopsData);
        await AsyncStorage.setItem('products', JSON.stringify(sortedProducts));
      } catch (error) {
        console.error('Error fetching products:', error);
        Alert.alert('Error', 'Failed to fetch products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentLocation]);

  // Function to group products by shop
  const groupProductsByShop = (products: ProductWithDistance[], shopsData: Shop[]) => {
    const grouped: { [key: string]: ProductWithDistance[] } = {};
    
    // Group products by shopId
    products.forEach(product => {
      const shopId = product.shopId || 'unknown';
      if (!grouped[shopId]) {
        grouped[shopId] = [];
      }
      grouped[shopId].push(product);
    });

    // Convert to SectionList format
    const sections: GroupedProduct[] = Object.entries(grouped).map(([shopId, shopProducts]) => {
      const shopInfo = shopsData.find(shop => shop.id === shopId) || {
        id: shopId,
        name: shopProducts[0]?.shopName || 'Unknown Shop',
        farmerId: '',
        location: { latitude: 0, longitude: 0 },
      };

      return {
        title: shopInfo.name,
        shopId: shopId,
        shopInfo: shopInfo,
        data: shopProducts,
      };
    });

    // Sort sections by distance if available, otherwise by shop name
    sections.sort((a, b) => {
      if (a.shopInfo.distance !== undefined && b.shopInfo.distance !== undefined) {
        return a.shopInfo.distance - b.shopInfo.distance;
      }
      return a.title.localeCompare(b.title);
    });

    setGroupedProducts(sections);
  };

  // Add to Cart function
  const handleAddToCart = async (product: ProductWithDistance) => {
    setAddingToCart(product.id);
    try {
      await addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        unit: product.unit,
        shopId: product.shopId,
        shopName: product.shopName,
        farmerId: product.farmerId,
      });
      
      Toast.show({
        type: 'success',
        text1: 'Added to Cart',
        text2: `${product.name} has been added to your cart`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add to cart',
      });
    } finally {
      setAddingToCart(null);
    }
  };

  // Filter products based on distance and search query
  const filteredProducts = products.filter(product => {
    // Search filter
    const matchesSearch = searchQuery.length === 0 || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.shopName && product.shopName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Distance filter
    const matchesDistance = !filterByDistance || !currentLocation || 
      (product.distance !== undefined && product.distance <= maxDistance);
    
    return matchesSearch && matchesDistance;
  });

  // Update grouped products when filters change
  useEffect(() => {
    if (products.length > 0) {
      groupProductsByShop(filteredProducts, shops);
    }
  }, [products, shops, filterByDistance, maxDistance, currentLocation, searchQuery]);

  // Function to handle quick navigation to shop
  const handleQuickNavigation = (product: ProductWithDistance) => {
    const shop = shops.find(s => s.id === product.shopId);
    if (shop && shop.location) {
      quickNavigateToGoogleMaps({
        latitude: shop.location.latitude,
        longitude: shop.location.longitude,
        name: shop.name,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2d5a3d" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f7f0' }}>
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerText}>Fresh Products</Text>
            <Text style={styles.headerSubtext}>Discover quality farm products</Text>
          </View>
          
          {/* View Mode Toggle */}
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grouped' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('grouped')}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === 'grouped' ? '#2d5a3d' : '#ffffff'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons name="grid-outline" size={18} color={viewMode === 'grid' ? '#2d5a3d' : '#ffffff'} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#a0aec0" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products or shops..."
            placeholderTextColor="#6b8e70"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#6b8e70" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Location Filter Toggle - Compact */}
        {locationEnabled && (
          <View style={styles.locationControls}>
            <TouchableOpacity
              style={[styles.locationToggle, filterByDistance && styles.locationToggleActive]}
              onPress={() => setShowDistanceModal(true)}
            >
              <Ionicons 
                name={filterByDistance ? "location" : "location-outline"} 
                size={18} 
                color={filterByDistance ? "#fff" : "#4CAF50"} 
              />
              <Text style={[styles.locationToggleText, filterByDistance && styles.locationToggleTextActive]}>
                Filter Nearby Shops({filteredProducts.length})
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={filterByDistance ? "#fff" : "#4CAF50"} 
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
            
            {filterByDistance && (
              <TouchableOpacity
                style={styles.mapButtonSmall}
                onPress={() => setShowMap(true)}
              >
                <Ionicons name="map-outline" size={18} color="#2d5a3d" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      
      {viewMode === 'grouped' ? (
        <SectionList
          sections={groupedProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.productCardHorizontal}>
              <Link href={{ pathname: '/product/[id]', params: { id: item.id } }} asChild>
                <TouchableOpacity style={styles.productCardHorizontalContent}>
                  <Image source={{ uri: item.image }} style={styles.productImageHorizontal} />
                  <View style={styles.productInfoHorizontal}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.productPrice}>৳{item.price.toFixed(2)}</Text>
                      <Text style={styles.productUnit}>/{item.unit}</Text>
                    </View>
                    
                    {item.distance !== undefined && (
                      <View style={styles.distanceInfo}>
                        <Ionicons name="location-outline" size={12} color="#1a3d2e" />
                        <Text style={styles.distanceText}>
                          {formatDistance(item.distance)} away
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Link>
              
              {/* Add to Cart Button */}
              <TouchableOpacity
                style={styles.addToCartButtonHorizontal}
                onPress={() => handleAddToCart(item)}
                disabled={addingToCart === item.id}
              >
                {addingToCart === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="cart" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}
          renderSectionHeader={({ section }) => {
            // Different left border colors for variety based on shop name
            const borderColors = ['#2d5a3d', '#4a6b4f', '#1a3d2e', '#3e7b3e', '#225533'];
            const colorIndex = section.shopId.length % borderColors.length;
            const borderColor = borderColors[colorIndex];
            
            return (
              <View style={[styles.shopHeader, { borderLeftColor: borderColor }]}>
                <View style={styles.shopHeaderLeft}>
                  <Ionicons name="storefront" size={26} color={borderColor} />
                  <View style={styles.shopHeaderInfo}>
                    <Text style={styles.shopHeaderTitle}>{section.title}</Text>
                    <Text style={styles.shopHeaderSubtitle}>
                      {section.data.length} product{section.data.length !== 1 ? 's' : ''}
                      {section.shopInfo.distance !== undefined && 
                        ` • ${formatDistance(section.shopInfo.distance)} away`
                      }
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.shopNavigateButton, { borderColor: borderColor }]}
                  onPress={() => handleQuickNavigation(section.data[0])}
                >
                  <Ionicons name="navigate" size={18} color={borderColor} />
                </TouchableOpacity>
              </View>
            );
          }}
          contentContainerStyle={styles.productsContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <Link href={{ pathname: '/product/[id]', params: { id: item.id } }} asChild>
                <TouchableOpacity style={styles.productCardContent}>
                  <Image source={{ uri: item.image }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>৳{item.price.toFixed(2)}</Text>
                    <Text style={styles.productUnit}>/{item.unit}</Text>
                    
                    {/* Show shop info and distance */}
                    {item.shopName && (
                      <View style={styles.shopInfo}>
                        <Ionicons name="storefront-outline" size={12} color="#2d5a3d" />
                        <Text style={styles.shopName} numberOfLines={1}>
                          {item.shopName}
                        </Text>
                      </View>
                    )}
                    
                    {item.distance !== undefined && (
                      <View style={styles.distanceInfo}>
                        <Ionicons name="location-outline" size={12} color="#1a3d2e" />
                        <Text style={styles.distanceText}>
                          {formatDistance(item.distance)} away
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Link>
              
              {/* No Add to Cart Button in grid view for cleaner look */}
            </View>
          )}
          contentContainerStyle={styles.productsContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Map Modal */}
      <NearbyShopsMap
        shops={shops}
        userLocation={currentLocation}
        maxDistance={maxDistance}
        visible={showMap}
        onClose={() => setShowMap(false)}
        onShopSelect={(shop) => {
          console.log('Selected shop:', shop);
          setShowMap(false);
        }}
      />
      
      {/* Debug Modal */}
      {showDebug && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          zIndex: 1000,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            backgroundColor: '#4CAF50',
            paddingTop: 50,
          }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
              Debug Shop Data
            </Text>
            <TouchableOpacity onPress={() => setShowDebug(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <DebugShopData shops={shops} currentLocation={currentLocation} />
        </View>
      )}
      
      {/* Distance Selection Modal */}
      {showDistanceModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nearby Shops Filter</Text>
              <TouchableOpacity onPress={() => setShowDistanceModal(false)}>
                <Ionicons name="close" size={24} color="#2d3748" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Choose maximum distance to find shops near you
              </Text>
              
              <View style={styles.distanceOptions}>
                {[
                  { value: 5, label: '5 km', desc: 'Very close' },
                  { value: 10, label: '10 km', desc: 'Nearby' },
                  { value: 20, label: '20 km', desc: 'Moderate distance' },
                  { value: 50, label: '50 km', desc: 'Extended area' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.distanceOption,
                      maxDistance === option.value && styles.distanceOptionActive
                    ]}
                    onPress={() => {
                      setMaxDistance(option.value);
                      setFilterByDistance(true);
                    }}
                  >
                    <View style={styles.distanceOptionContent}>
                      <Text style={[
                        styles.distanceOptionLabel,
                        maxDistance === option.value && styles.distanceOptionLabelActive
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={[
                        styles.distanceOptionDesc,
                        maxDistance === option.value && styles.distanceOptionDescActive
                      ]}>
                        {option.desc}
                      </Text>
                    </View>
                    {maxDistance === option.value && (
                      <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionCancel}
                  onPress={() => {
                    setFilterByDistance(false);
                    setShowDistanceModal(false);
                  }}
                >
                  <Text style={styles.modalActionCancelText}>Turn Off Filter</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalActionConfirm}
                  onPress={() => setShowDistanceModal(false)}
                >
                  <Text style={styles.modalActionConfirmText}>Apply Filter</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.resultPreview}>
                <Text style={styles.resultPreviewText}>
                  {filteredProducts.length} products found within {maxDistance} km
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f7f0',
  },
  loadingText: {
    fontSize: 16,
    color: '#2d5a3d',
    marginTop: 10,
    fontWeight: '600',
  },
  // Enhanced header with darkish green theme
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#2d5a3d',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#1a3d2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerSubtext: {
    fontSize: 15,
    color: '#a8d5ba',
    fontWeight: '500',
  },
  // Enhanced search with green theme
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#1a3d2e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
    color: '#4a6b4f',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2d5a3d',
    paddingVertical: 0,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Enhanced location toggle with theme
  locationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'flex-start',
  },
  locationToggleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  locationToggleTextActive: {
    color: '#2d5a3d',
  },
  locationToggleActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  compactFilterContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    fontSize: 16,
    color: '#2d5a3d',
    flex: 1,
    marginLeft: 12,
    fontWeight: '600',
  },
  distanceContainer: {
    marginTop: 16,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#4a6b4f',
    flex: 1,
    fontWeight: '500',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#2d5a3d',
  },
  mapButtonText: {
    fontSize: 12,
    color: '#2d5a3d',
    marginLeft: 6,
    fontWeight: '600',
  },
  distanceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  distanceButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#f0f7f0',
    borderWidth: 1,
    borderColor: '#c8e6c9',
    minWidth: 60,
    alignItems: 'center',
  },
  distanceButtonActive: {
    backgroundColor: '#2d5a3d',
    borderColor: '#2d5a3d',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  distanceButtonText: {
    fontSize: 13,
    color: '#4a6b4f',
    fontWeight: '600',
  },
  distanceButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  productsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  // Enhanced product cards with green theme
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  productCardContent: {
    flex: 1,
  },
  productImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
    backgroundColor: '#f0f7f0',
  },
  productInfo: {
    padding: 16,
    paddingBottom: 20,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    color: '#2d5a3d',
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a3d2e',
  },
  productUnit: {
    fontSize: 13,
    color: '#6b8e70',
    marginLeft: 4,
    marginBottom: 8,
    fontWeight: '500',
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  shopName: {
    fontSize: 12,
    color: '#2d5a3d',
    marginLeft: 6,
    flex: 1,
    fontWeight: '600',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#f0f7f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  distanceText: {
    fontSize: 12,
    color: '#1a3d2e',
    marginLeft: 4,
    fontWeight: '700',
  },
  addToCartButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#2d5a3d',
    borderRadius: 25,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Enhanced view mode with green theme
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  // Enhanced shop header with gradient-like colors
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#4a6b4f',
  },
  shopHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopHeaderInfo: {
    marginLeft: 16,
    flex: 1,
  },
  shopHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2d5a3d',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  shopHeaderSubtitle: {
    fontSize: 14,
    color: '#4a6b4f',
    fontWeight: '600',
  },
  shopNavigateButton: {
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2d5a3d',
  },
  // Enhanced horizontal product cards
  productCardHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 18,
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  productCardHorizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 70,
  },
  productImageHorizontal: {
    width: 90,
    height: 90,
    borderRadius: 15,
    backgroundColor: '#f0f7f0',
    margin: 16,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  productInfoHorizontal: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 6,
  },
  addToCartButtonHorizontal: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#2d5a3d',
    borderRadius: 25,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Location controls with theme
  locationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapButtonSmall: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 12,
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Enhanced modal styles with green theme
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(45, 90, 61, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginHorizontal: 20,
    maxHeight: '80%',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
    backgroundColor: '#f8fcf9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2d5a3d',
    letterSpacing: 0.3,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#4a6b4f',
    marginBottom: 24,
    lineHeight: 24,
    fontWeight: '500',
  },
  distanceOptions: {
    marginBottom: 24,
  },
  distanceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e8f5e8',
    backgroundColor: '#f8fcf9',
    marginBottom: 12,
  },
  distanceOptionActive: {
    backgroundColor: '#2d5a3d',
    borderColor: '#2d5a3d',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  distanceOptionContent: {
    flex: 1,
  },
  distanceOptionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d5a3d',
    marginBottom: 2,
  },
  distanceOptionLabelActive: {
    color: '#ffffff',
  },
  distanceOptionDesc: {
    fontSize: 14,
    color: '#4a6b4f',
    fontWeight: '500',
  },
  distanceOptionDescActive: {
    color: '#a8d5ba',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalActionCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#f0f7f0',
    borderWidth: 1,
    borderColor: '#c8e6c9',
    marginRight: 8,
    alignItems: 'center',
  },
  modalActionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a6b4f',
  },
  modalActionConfirm: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#2d5a3d',
    marginLeft: 8,
    alignItems: 'center',
    shadowColor: '#2d5a3d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  modalActionConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  resultPreview: {
    backgroundColor: '#e8f5e8',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d5a3d',
    alignItems: 'center',
  },
  resultPreviewText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3d2e',
  },
});
