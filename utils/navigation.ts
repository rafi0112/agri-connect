import { Alert, Linking, Platform } from 'react-native';

export interface NavigationDestination {
  latitude: number;
  longitude: number;
  name?: string;
}

/**
 * Open navigation to a destination with multiple app options
 */
export const openNavigation = (destination: NavigationDestination) => {
  const { latitude, longitude, name = 'Destination' } = destination;
  const coords = `${latitude},${longitude}`;
  const encodedName = encodeURIComponent(name);

  Alert.alert(
    'Get Directions',
    `Choose your preferred navigation app to go to ${name}`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Google Maps',
        onPress: () => openGoogleMaps(coords, encodedName),
      },
      ...(Platform.OS === 'ios' ? [{
        text: 'Apple Maps',
        onPress: () => openAppleMaps(coords, encodedName),
      }] : []),
      {
        text: 'Waze',
        onPress: () => openWaze(coords, encodedName),
      },
    ]
  );
};

/**
 * Open Google Maps with directions
 */
const openGoogleMaps = async (coords: string, name: string) => {
  const scheme = Platform.select({
    ios: 'comgooglemaps',
    android: 'google.navigation',
  });

  const url = Platform.select({
    ios: `comgooglemaps://?daddr=${coords}&directionsmode=driving`,
    android: `google.navigation:q=${coords}&mode=d`,
  });

  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=driving`;

  try {
    if (url && await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      // Fallback to web version
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening Google Maps:', error);
    Alert.alert('Error', 'Could not open navigation app. Opening in browser...');
    try {
      await Linking.openURL(webUrl);
    } catch (webError) {
      Alert.alert('Error', 'Could not open directions');
    }
  }
};

/**
 * Open Apple Maps with directions (iOS only)
 */
const openAppleMaps = async (coords: string, name: string) => {
  const url = `http://maps.apple.com/?daddr=${coords}&dirflg=d`;
  
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Apple Maps is not available');
    }
  } catch (error) {
    console.error('Error opening Apple Maps:', error);
    Alert.alert('Error', 'Could not open Apple Maps');
  }
};

/**
 * Open Waze with directions
 */
const openWaze = async (coords: string, name: string) => {
  const url = `waze://?ll=${coords}&navigate=yes`;
  const webUrl = `https://waze.com/ul?ll=${coords}&navigate=yes`;
  
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      // Fallback to web version
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening Waze:', error);
    Alert.alert('Error', 'Could not open Waze');
  }
};

/**
 * Quick navigation to Google Maps (most common use case)
 */
export const quickNavigateToGoogleMaps = async (destination: NavigationDestination) => {
  const { latitude, longitude, name = 'Destination' } = destination;
  const coords = `${latitude},${longitude}`;
  
  const url = Platform.select({
    ios: `comgooglemaps://?daddr=${coords}&directionsmode=driving`,
    android: `google.navigation:q=${coords}&mode=d`,
  });

  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=driving`;

  try {
    if (url && await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening navigation:', error);
    Alert.alert('Error', 'Could not open navigation');
  }
};
