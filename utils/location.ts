import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Validate if location coordinates are valid (handles both string and number formats)
 * @param location - Location object to validate
 * @returns boolean indicating if location is valid
 */
export const isValidLocation = (location: any): location is LocationCoordinates => {
  if (!location || typeof location !== 'object') {
    return false;
  }

  // Convert to numbers and validate
  const lat = typeof location.latitude === 'string' ? parseFloat(location.latitude) : location.latitude;
  const lon = typeof location.longitude === 'string' ? parseFloat(location.longitude) : location.longitude;

  return typeof lat === 'number' && 
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 && 
    lat <= 90 &&
    lon >= -180 && 
    lon <= 180;
};

/**
 * Normalize location coordinates to numbers (handles both string and number inputs)
 * @param location - Location object with string or number coordinates
 * @returns LocationCoordinates with numeric values or null if invalid
 */
export const normalizeLocation = (location: any): LocationCoordinates | null => {
  if (!isValidLocation(location)) {
    return null;
  }

  return {
    latitude: typeof location.latitude === 'string' ? parseFloat(location.latitude) : location.latitude,
    longitude: typeof location.longitude === 'string' ? parseFloat(location.longitude) : location.longitude,
  };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Get user's current location with permission handling
 * @returns Promise<LocationCoordinates | null>
 */
export const getCurrentLocation = async (): Promise<LocationCoordinates | null> => {
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return null;
    }

    let location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

/**
 * Format distance for display
 * @param distance - Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

/**
 * Sort array of items by distance from user location
 * @param items - Array of items with distance property
 * @returns Sorted array
 */
export const sortByDistance = <T extends { distance?: number }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    if (a.distance !== undefined && b.distance !== undefined) {
      return a.distance - b.distance;
    }
    if (a.distance !== undefined) return -1;
    if (b.distance !== undefined) return 1;
    return 0;
  });
};
