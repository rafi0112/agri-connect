import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, LocationCoordinates, isValidLocation, normalizeLocation } from '../utils/location';
import { openNavigation } from '../utils/navigation';

interface Shop {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
}

interface NearbyShopsMapProps {
  shops: Shop[];
  userLocation: LocationCoordinates | null;
  maxDistance: number;
  onShopSelect?: (shop: Shop) => void;
  visible: boolean;
  onClose: () => void;
}

export default function NearbyShopsMap({
  shops,
  userLocation,
  maxDistance,
  onShopSelect,
  visible,
  onClose
}: NearbyShopsMapProps) {
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  useEffect(() => {
    if (userLocation) {
      // Calculate appropriate delta based on max distance
      const delta = maxDistance / 111; // Rough conversion from km to degrees
      setMapRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: delta * 2,
        longitudeDelta: delta * 2,
      });
    }
  }, [userLocation, maxDistance]);

  const filteredShops = shops.filter(shop => {
    // Ensure shop has valid location data using utility function
    if (!isValidLocation(shop.location)) {
      console.warn('Shop has invalid location data:', shop);
      return false;
    }
    
    return shop.distance !== undefined && shop.distance <= maxDistance;
  }).map(shop => ({
    ...shop,
    location: normalizeLocation(shop.location) || shop.location
  }));

  // Function to open directions to a shop
  const openDirections = (shop: Shop) => {
    openNavigation({
      latitude: shop.location.latitude,
      longitude: shop.location.longitude,
      name: shop.name,
    });
  };

  if (!mapRegion) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.loadingContainer}>
          <Text>Loading map...</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nearby Shops Map</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        <MapView style={styles.map} initialRegion={mapRegion}>
          {/* User location marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Your Location"
              pinColor="blue"
            >
              <View style={styles.userMarker}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            </Marker>
          )}
          
          {/* Distance circle */}
          {userLocation && (
            <Circle
              center={userLocation}
              radius={maxDistance * 1000} // Convert km to meters
              strokeColor="rgba(76, 175, 80, 0.5)"
              fillColor="rgba(76, 175, 80, 0.1)"
              strokeWidth={2}
            />
          )}
          
          {/* Shop markers */}
          {filteredShops.map((shop) => (
            <Marker
              key={shop.id}
              coordinate={shop.location}
              title={shop.name}
              description={shop.distance ? `${shop.distance.toFixed(1)} km away • Tap for directions` : 'Tap for directions'}
              pinColor="green"
              onPress={() => {
                onShopSelect?.(shop);
                // Small delay to allow callout to show, then auto-open directions
                setTimeout(() => openDirections(shop), 500);
              }}
              onCalloutPress={() => openDirections(shop)}
            >
              <View style={styles.shopMarker}>
                <Ionicons name="storefront" size={20} color="#fff" />
              </View>
            </Marker>
          ))}
        </MapView>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Showing {filteredShops.length} shops within {maxDistance} km
          </Text>
          <Text style={styles.instructionText}>
            💡 Tap on any shop marker to get directions
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingTop: 50, // Account for status bar
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  shopMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  footer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
});
