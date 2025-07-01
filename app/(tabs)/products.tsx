import { useState, useEffect } from 'react';
import { View, Text, FlatList, SectionList, Image, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Switch, ScrollView, TextInput, useColorScheme } from 'react-native';
import { collection, getDocs, getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../config/firebase';
import { Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getCurrentLocation, calculateDistance, formatDistance, sortByDistance, isValidLocation, normalizeLocation } from '../../utils/location';
import { quickNavigateToGoogleMaps } from '../../utils/navigation';
import NearbyShopsMap from '../../components/NearbyShopsMap';
import DebugShopData from '../../components/DebugShopData';
import { useCart } from '../../context/CartProvider';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
      <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.textPrimary}]}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.headerGradient}
      >
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleSection}>
              <Text style={styles.headerText}>Fresh Products</Text>
              <Text style={styles.headerSubtext}>Discover quality farm products</Text>
            </View>
            
            {/* View Mode Toggle */}
            <View style={styles.viewModeContainer}>
              <TouchableOpacity
                style={[
                  styles.viewModeButton, 
                  viewMode === 'grouped' && styles.viewModeButtonActive,
                  {backgroundColor: viewMode === 'grouped' ? '#ffffff' : 'rgba(255,255,255,0.3)'}
                ]}
                onPress={() => setViewMode('grouped')}
              >
                <Ionicons 
                  name="list-outline" 
                  size={18} 
                  color={viewMode === 'grouped' ? colors.primary : '#ffffff'} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewModeButton, 
                  viewMode === 'grid' && styles.viewModeButtonActive,
                  {backgroundColor: viewMode === 'grid' ? '#ffffff' : 'rgba(255,255,255,0.3)'}
                ]}
                onPress={() => setViewMode('grid')}
              >
                <Ionicons 
                  name="grid-outline" 
                  size={18} 
                  color={viewMode === 'grid' ? colors.primary : '#ffffff'} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Search Input */}
          <View style={[styles.searchContainer, {backgroundColor: 'rgba(255,255,255,0.2)'}]}>
            <Ionicons name="search" size={20} color="#ffffff" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, {color: '#ffffff'}]}
              placeholder="Search products or shops..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
      
      {/* Location Filter Toggle - Outside Header */}
      {locationEnabled && (
        <View style={styles.locationControls}>
          <TouchableOpacity
            style={[
              styles.locationToggle, 
              filterByDistance && styles.locationToggleActive,
              {
                backgroundColor: filterByDistance ? colors.primary : colors.cardBackground,
                borderColor: colors.primary
              }
            ]}
            onPress={() => setShowDistanceModal(true)}
          >
            <Ionicons 
              name={filterByDistance ? "location" : "location-outline"} 
              size={18} 
              color={filterByDistance ? "#fff" : colors.primary} 
            />
            <Text 
              style={[
                styles.locationToggleText, 
                filterByDistance && styles.locationToggleTextActive,
                {color: filterByDistance ? "#fff" : colors.primary}
              ]}
            >
              Filter Nearby Shops({filteredProducts.length})
            </Text>
            <Ionicons 
              name="chevron-down" 
              size={16} 
              color={filterByDistance ? "#fff" : colors.primary} 
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
          
          {filterByDistance && (
            <TouchableOpacity
              style={[styles.mapButtonSmall, {backgroundColor: colors.cardBackground, borderColor: colors.primary}]}
              onPress={() => setShowMap(true)}
            >
              <Ionicons name="map-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {viewMode === 'grouped' ? (
        <SectionList
          sections={groupedProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.productCardHorizontal, {backgroundColor: colors.cardBackground}]}>
              <Link href={{ pathname: '/product/[id]', params: { id: item.id } }} asChild>
                <TouchableOpacity style={styles.productCardHorizontalContent}>
                  <Image source={{ uri: item.image }} style={styles.productImageHorizontal} />
                  <View style={styles.productInfoHorizontal}>
                    <Text style={[styles.productName, {color: colors.textPrimary}]}>{item.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.productPrice, {color: colors.primary}]}>৳{item.price.toFixed(2)}</Text>
                      <Text style={[styles.productUnit, {color: colors.textSecondary}]}>/{item.unit}</Text>
                    </View>
                    
                    {item.distance !== undefined && (
                      <View style={styles.distanceInfo}>
                        <Ionicons name="location-outline" size={12} color={colors.info} />
                        <Text style={[styles.distanceText, {color: colors.info}]}>
                          {formatDistance(item.distance)} away
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Link>
              
              {/* Add to Cart Button */}
              <TouchableOpacity
                style={[styles.addToCartButtonHorizontal, {backgroundColor: colors.primary}]}
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
            const borderColors = [colors.primary, colors.success, colors.info, colors.accent, colors.secondary];
            const colorIndex = section.shopId.length % borderColors.length;
            const borderColor = borderColors[colorIndex];
            
            return (
              <View style={[
                styles.shopHeader, 
                { 
                  borderLeftColor: borderColor,
                  backgroundColor: colors.cardBackgroundLight
                }
              ]}>
                <View style={styles.shopHeaderLeft}>
                  <Ionicons name="storefront" size={26} color={borderColor} />
                  <View style={styles.shopHeaderInfo}>
                    <Text style={[styles.shopHeaderTitle, {color: colors.textPrimary}]}>{section.title}</Text>
                    <Text style={[styles.shopHeaderSubtitle, {color: colors.textSecondary}]}>
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
            <View style={[styles.productCard, {backgroundColor: colors.cardBackground}]}>
              <Link href={{ pathname: '/product/[id]', params: { id: item.id } }} asChild>
                <TouchableOpacity style={styles.productCardContent}>
                  <Image source={{ uri: item.image }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, {color: colors.textPrimary}]}>{item.name}</Text>
                    <Text style={[styles.productPrice, {color: colors.primary}]}>৳{item.price.toFixed(2)}</Text>
                    <Text style={[styles.productUnit, {color: colors.textSecondary}]}>/{item.unit}</Text>
                    
                    {/* Show shop info and distance */}
                    {item.shopName && (
                      <View style={styles.shopInfo}>
                        <Ionicons name="storefront-outline" size={12} color={colors.primary} />
                        <Text style={[styles.shopName, {color: colors.textSecondary}]} numberOfLines={1}>
                          {item.shopName}
                        </Text>
                      </View>
                    )}
                    
                    {item.distance !== undefined && (
                      <View style={styles.distanceInfo}>
                        <Ionicons name="location-outline" size={12} color={colors.info} />
                        <Text style={[styles.distanceText, {color: colors.info}]}>
                          {formatDistance(item.distance)} away
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Link>
              
              {/* Add to cart button in grid view */}
              <TouchableOpacity
                style={[styles.addToCartButton, {backgroundColor: colors.primary}]}
                onPress={() => handleAddToCart(item)}
                disabled={addingToCart === item.id}
              >
                {addingToCart === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="cart" size={16} color="#fff" />
                )}
              </TouchableOpacity>
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
        <View style={[styles.modalOverlay, {backgroundColor: colors.overlay}]}>
          <View style={[styles.modalContainer, {backgroundColor: colors.cardBackground}]}>
            <LinearGradient
              colors={[colors.primaryLight, colors.primary]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Nearby Shops Filter</Text>
              <TouchableOpacity onPress={() => setShowDistanceModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.modalContent}>
              <Text style={[styles.modalDescription, {color: colors.textPrimary}]}>
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
                      maxDistance === option.value && styles.distanceOptionActive,
                      {
                        backgroundColor: maxDistance === option.value ? colors.primary : colors.cardBackgroundLight,
                      }
                    ]}
                    onPress={() => {
                      setMaxDistance(option.value);
                      setFilterByDistance(true);
                    }}
                  >
                    <View style={styles.distanceOptionContent}>
                      <Text style={[
                        styles.distanceOptionLabel,
                        maxDistance === option.value && styles.distanceOptionLabelActive,
                        {color: maxDistance === option.value ? "#ffffff" : colors.textPrimary}
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={[
                        styles.distanceOptionDesc,
                        maxDistance === option.value && styles.distanceOptionDescActive,
                        {color: maxDistance === option.value ? "rgba(255,255,255,0.8)" : colors.textSecondary}
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
                  style={[styles.modalActionCancel, {backgroundColor: colors.errorLight}]}
                  onPress={() => {
                    setFilterByDistance(false);
                    setShowDistanceModal(false);
                  }}
                >
                  <Text style={[styles.modalActionCancelText, {color: colors.error}]}>Turn Off Filter</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalActionApply, {backgroundColor: colors.primary}]}
                  onPress={() => setShowDistanceModal(false)}
                >
                  <Text style={styles.modalActionApplyText}>Apply Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f7f0',
  },
  headerGradient: {
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContainer: {
    paddingHorizontal: 16,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  viewModeButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 40,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f7f0',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  // Location Controls
  locationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 12,
    gap: 8,
  },
  locationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    borderWidth: 1,
  },
  locationToggleActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  locationToggleText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  locationToggleTextActive: {
    color: '#fff',
  },
  mapButtonSmall: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Products List
  productsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  // Shop Headers
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shopHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  shopHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  shopHeaderSubtitle: {
    fontSize: 12,
  },
  shopNavigateButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  // Product Cards - Horizontal
  productCardHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  productCardHorizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    padding: 12,
  },
  productImageHorizontal: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfoHorizontal: {
    flex: 1,
  },
  addToCartButtonHorizontal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d5a3d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Product Cards - Grid
  productCard: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  productCardContent: {
    padding: 0,
  },
  productImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  productUnit: {
    fontSize: 12,
    marginLeft: 2,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  shopName: {
    fontSize: 11,
    marginLeft: 4,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  distanceText: {
    fontSize: 11,
    marginLeft: 4,
  },
  addToCartButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2d5a3d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalContent: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  distanceOptions: {
    marginBottom: 20,
  },
  distanceOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  distanceOptionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  distanceOptionContent: {
    flex: 1,
  },
  distanceOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  distanceOptionLabelActive: {
    color: '#fff',
  },
  distanceOptionDesc: {
    fontSize: 12,
  },
  distanceOptionDescActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalActionCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  modalActionCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  modalActionApply: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  modalActionApplyText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
