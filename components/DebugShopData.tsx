import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { isValidLocation, normalizeLocation } from '../utils/location';

interface DebugShopDataProps {
  shops: any[];
  currentLocation: { latitude: number; longitude: number } | null;
}

export default function DebugShopData({ shops, currentLocation }: DebugShopDataProps) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Debug: Shop Data Analysis</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Location:</Text>
        <Text style={styles.dataText}>
          {currentLocation 
            ? `Lat: ${currentLocation.latitude}, Lon: ${currentLocation.longitude}`
            : 'No location available'
          }
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shops Found: {shops.length}</Text>
        {shops.map((shop, index) => (
          <View key={index} style={styles.shopItem}>
            <Text style={styles.shopTitle}>Shop {index + 1}: {shop.name}</Text>
            <Text style={styles.dataText}>ID: {shop.id}</Text>
            <Text style={styles.dataText}>Distance: {shop.distance || 'Not calculated'}</Text>
            <Text style={styles.dataText}>
              Location Type: {typeof shop.location}
            </Text>
            <Text style={styles.dataText}>
              Location Data: {JSON.stringify(shop.location, null, 2)}
            </Text>
            {shop.location && typeof shop.location === 'object' && (
              <>
                <Text style={styles.dataText}>
                  Latitude: {shop.location.latitude} (Type: {typeof shop.location.latitude})
                </Text>
                <Text style={styles.dataText}>
                  Longitude: {shop.location.longitude} (Type: {typeof shop.location.longitude})
                </Text>
                <Text style={styles.dataText}>
                  Valid Location: {isValidLocation(shop.location) ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.dataText}>
                  Normalized Location: {JSON.stringify(normalizeLocation(shop.location), null, 2)}
                </Text>
              </>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#4CAF50',
  },
  shopItem: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f1f3f4',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  shopTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  dataText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});
