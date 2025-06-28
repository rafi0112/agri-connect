import { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
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
};

// Define the ProductWithDistance type
type ProductWithDistance = Product & {
  distance?: number;
  shopName?: string;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<ProductWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [filterByDistance, setFilterByDistance] = useState(false);
  const [maxDistance, setMaxDistance] = useState(10); // 10 km default
  const [showMap, setShowMap] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false); // Add debug toggle
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
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

  // Test function to add sample data to cart
  const addTestDataToCart = async () => {
    const testProducts = [
      {
        id: 'test_1',
        name: 'Fresh Tomatoes',
        price: 60,
        image: 'https://images.unsplash.com/photo-1592921870789-04563d55041c',
        unit: 'kg',
        shopId: 'test_shop_1',
        shopName: 'Green Farm Store',
        farmerId: 'farmer_1',
      },
      {
        id: 'test_2',
        name: 'Organic Carrots',
        price: 45,
        image: 'https://images.unsplash.com/photo-1445282768818-728615cc910a',
        unit: 'kg',
        shopId: 'test_shop_2',
        shopName: 'Organic Valley',
        farmerId: 'farmer_2',
      },
      {
        id: 'test_3',
        name: 'Fresh Spinach',
        price: 30,
        image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb',
        unit: 'kg',
        shopId: 'test_shop_1',
        shopName: 'Green Farm Store',
        farmerId: 'farmer_1',
      }
    ];

    for (const product of testProducts) {
      await addToCart(product);
    }

    Toast.show({
      type: 'success',
      text1: 'Test Data Added',
      text2: 'Sample products added to cart for testing',
    });
  };

  // Filter products based on distance
  const filteredProducts = filterByDistance && currentLocation
    ? products.filter(product => 
        product.distance !== undefined && product.distance <= maxDistance
      )
    : products;

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
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Explore Our Products</Text>
        
        {/* Test Cart Button */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={addTestDataToCart}
        >
          <Ionicons name="cart" size={16} color="#fff" />
          <Text style={styles.testButtonText}>Add Test Items</Text>
        </TouchableOpacity>
      </View>
      
      {/* Location Filter Controls */}
      {locationEnabled && (
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <Ionicons name="location-outline" size={20} color="#4CAF50" />
            <Text style={styles.filterLabel}>Filter by nearby shops</Text>
            <Switch
              value={filterByDistance}
              onValueChange={setFilterByDistance}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={filterByDistance ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          {filterByDistance && (
            <View style={styles.distanceContainer}>
              <View style={styles.distanceRow}>
                <Text style={styles.distanceLabel}>
                  Within {maxDistance} km ({filteredProducts.length} products found)
                </Text>
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={() => setShowMap(true)}
                >
                  <Ionicons name="map-outline" size={16} color="#4CAF50" />
                  <Text style={styles.mapButtonText}>View Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mapButton, { backgroundColor: '#fff3cd' }]}
                  onPress={() => setShowDebug(true)}
                >
                  <Ionicons name="bug-outline" size={16} color="#856404" />
                  <Text style={[styles.mapButtonText, { color: '#856404' }]}>Debug</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.distanceButtons}>
                {[5, 10, 20, 50].map((distance) => (
                  <TouchableOpacity
                    key={distance}
                    style={[
                      styles.distanceButton,
                      maxDistance === distance && styles.distanceButtonActive
                    ]}
                    onPress={() => setMaxDistance(distance)}
                  >
                    <Text style={[
                      styles.distanceButtonText,
                      maxDistance === distance && styles.distanceButtonTextActive
                    ]}>
                      {distance}km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
      
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
                      <Ionicons name="storefront-outline" size={12} color="#666" />
                      <Text style={styles.shopName} numberOfLines={1}>
                        {item.shopName}
                      </Text>
                    </View>
                  )}
                  
                  {item.distance !== undefined && (
                    <View style={styles.distanceInfo}>
                      <Ionicons name="location-outline" size={12} color="#4CAF50" />
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
              style={styles.addToCartButton}
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
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  headerContainer: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    position: 'relative',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  testButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -15 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  filterContainer: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  distanceContainer: {
    marginTop: 12,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    marginLeft: 8,
  },
  mapButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  distanceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  distanceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  distanceButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  distanceButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  distanceButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  productsContainer: {
    padding: 16,
  },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  productCardContent: {
    flex: 1,
  },
  productImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
    backgroundColor: '#f5f5f5',
  },
  productInfo: {
    padding: 12,
    paddingBottom: 16,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  productUnit: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    marginBottom: 1,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  shopName: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  distanceText: {
    fontSize: 11,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  addToCartButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
