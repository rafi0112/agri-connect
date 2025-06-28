import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface LocationSelectorProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: LocationData;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  name?: string;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [addressName, setAddressName] = useState('');
  const [mapRegion, setMapRegion] = useState({
    latitude: 23.8103, // Default to Dhaka, Bangladesh
    longitude: 90.4125,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setAddressName(initialLocation.name || '');
      setMapRegion({
        ...mapRegion,
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      });
    }
  }, [initialLocation]);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use this feature');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await getAddressFromCoordinates(
        location.coords.latitude,
        location.coords.longitude
      );

      const currentLoc: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address,
      };

      setCurrentLocation(currentLoc);
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      if (!selectedLocation) {
        setSelectedLocation(currentLoc);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setLoading(false);
    }
  };

  const getAddressFromCoordinates = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (result.length > 0) {
        const addr = result[0];
        return `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`.trim();
      }
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLoading(true);
    
    try {
      const address = await getAddressFromCoordinates(latitude, longitude);
      const newLocation: LocationData = {
        latitude,
        longitude,
        address,
      };
      setSelectedLocation(newLocation);
    } catch (error) {
      console.error('Error handling map press:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLocation = () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    const locationWithName: LocationData = {
      ...selectedLocation,
      name: addressName.trim() || 'Selected Location',
    };

    onLocationSelect(locationWithName);
    onClose();
  };

  const handleUseCurrentLocation = () => {
    if (currentLocation) {
      setSelectedLocation(currentLocation);
      setMapRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Delivery Location</Text>
          <TouchableOpacity onPress={getCurrentLocation} style={styles.locationButton}>
            <Ionicons name="locate" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={mapRegion}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {selectedLocation && (
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
                title="Delivery Location"
                description={selectedLocation.address}
              />
            )}
          </MapView>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4CAF50" />
            </View>
          )}
        </View>

        {/* Location Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Location Details</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Location Name (Optional)</Text>
            <TextInput
              style={styles.input}
              value={addressName}
              onChangeText={setAddressName}
              placeholder="e.g., Home, Office, etc."
            />
          </View>

          {selectedLocation && (
            <View style={styles.addressContainer}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.addressText}>{selectedLocation.address}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            {currentLocation && (
              <TouchableOpacity
                style={styles.currentLocationButton}
                onPress={handleUseCurrentLocation}
              >
                <Ionicons name="locate" size={16} color="#2196F3" />
                <Text style={styles.currentLocationText}>Use Current Location</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, !selectedLocation && styles.disabledButton]}
              onPress={handleConfirmLocation}
              disabled={!selectedLocation}
            >
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 8,
  },
  locationButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    maxHeight: height * 0.4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  buttonContainer: {
    gap: 12,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  currentLocationText: {
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationSelector;
