import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, ActivityIndicator, ScrollView, useColorScheme } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { Stack, useNavigation } from 'expo-router';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import LocationSelector, { LocationData } from '../components/LocationSelector';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AddressScreen() {
	const { user } = useAuth();
	const db = getFirestore(app);
	const navigation = useNavigation();
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];
	
	const [loading, setLoading] = useState(true);
	const [isLocationSelectorVisible, setIsLocationSelectorVisible] = useState(false);
	const [savedLocation, setSavedLocation] = useState<LocationData | null>(null);
	
	useEffect(() => {
		const fetchUserLocation = async () => {
			if (!user) return;
			
			try {
				const userDoc = await getDoc(doc(db, 'users', user.id));
				if (userDoc.exists()) {
					const userData = userDoc.data();
					
					// Check if user has a delivery location saved
					if (userData.deliveryLocation) {
						setSavedLocation(userData.deliveryLocation);
					}
				}
			} catch (error) {
				console.error('Error fetching user location:', error);
			} finally {
				setLoading(false);
			}
		};
		
		fetchUserLocation();
	}, [user]);
	
	const handleLocationSelect = async (location: LocationData) => {
		setSavedLocation(location);
		setIsLocationSelectorVisible(false);
		
		if (!user) {
			Alert.alert('Error', 'User is not logged in.');
			return;
		}
		
		try {
			setLoading(true);
			
			// Format location data according to the required database structure
			const locationData = {
				// First format - deliveryLocation object with complete data
				deliveryLocation: {
					latitude: location.latitude,
					longitude: location.longitude,
					address: location.address,
					name: location.name || 'Selected Location'
				},
				
				// Second format - Separate delivery address field
				deliveryAddress: location.address,
				
				// Third format - "delivery location(map)" field with string coordinates
				'delivery location(map)': {
					'latitude(number/string)': location.latitude.toString(),
					'longitude(number/string)': location.longitude.toString()
				},
				
				// Set last updated timestamp
				updatedAt: new Date().toISOString()
			};
			
			await setDoc(doc(db, 'users', user.id), locationData, { merge: true });
			
			// Also save to AsyncStorage as backup for cart
			await AsyncStorage.setItem(
				`deliveryLocation_${user.id}`,
				JSON.stringify(location)
			);
			
			Alert.alert(
				'Success',
				'Delivery location saved successfully!',
				[{ text: 'OK' }]
			);
		} catch (error) {
			console.error('Error saving location:', error);
			Alert.alert('Error', 'Failed to save the delivery location.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
			
			<Stack.Screen
				options={{
					title: 'Delivery Address',
					headerStyle: {
						backgroundColor: colors.card,
					},
					headerTintColor: colors.text,
					headerShadowVisible: false,
				}}
			/>
			
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={[styles.loadingText, { color: colors.textLight }]}>
						Loading address information...
					</Text>
				</View>
			) : (
				<ScrollView style={styles.content}>
					<View style={[styles.card, { backgroundColor: colors.card }]}>
						<View style={styles.cardHeader}>
							<Ionicons name="location-outline" size={22} color={colors.primary} />
							<Text style={[styles.cardTitle, { color: colors.text }]}>Delivery Location</Text>
						</View>
						
						{savedLocation ? (
							<View style={styles.savedLocationContainer}>
								<View style={styles.locationDetails}>
									<Text style={[styles.locationName, { color: colors.text }]}>
										{savedLocation.name || 'Selected Location'}
									</Text>
									<Text style={[styles.locationAddress, { color: colors.textLight }]}>
										{savedLocation.address}
									</Text>
									<View style={[styles.coordsContainer, { backgroundColor: `${colors.primary}10` }]}>
										<Text style={[styles.coordsText, { color: colors.textLight }]}>
											Latitude: {savedLocation.latitude.toFixed(6)}
										</Text>
										<Text style={[styles.coordsText, { color: colors.textLight }]}>
											Longitude: {savedLocation.longitude.toFixed(6)}
										</Text>
									</View>
								</View>
								
								<TouchableOpacity 
									style={[styles.changeButton, { backgroundColor: `${colors.primary}15` }]}
									onPress={() => setIsLocationSelectorVisible(true)}
								>
									<Ionicons name="pencil" size={18} color={colors.primary} />
									<Text style={[styles.changeButtonText, { color: colors.primary }]}>
										Change
									</Text>
								</TouchableOpacity>
							</View>
						) : (
							<View style={styles.noLocationContainer}>
								<Ionicons
									name="location-outline"
									size={50}
									color={`${colors.primary}60`}
									style={styles.noLocationIcon}
								/>
								<Text style={[styles.noLocationText, { color: colors.textLight }]}>
									No delivery location set
								</Text>
								<TouchableOpacity
									style={[styles.addButton, { backgroundColor: colors.primary }]}
									onPress={() => setIsLocationSelectorVisible(true)}
								>
									<Ionicons name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
									<Text style={styles.addButtonText}>Add Location</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>
					
					<View style={[styles.infoCard, { backgroundColor: `${colors.info}15` }]}>
						<Ionicons name="information-circle" size={24} color={colors.info} />
						<Text style={[styles.infoText, { color: colors.info }]}>
							Your delivery address will be used for shipping your orders. Make sure it's accurate for timely delivery.
						</Text>
					</View>
				</ScrollView>
			)}
			
				{/* Location Selector Modal */}
			<LocationSelector
				visible={isLocationSelectorVisible}
				onClose={() => setIsLocationSelectorVisible(false)}
				onLocationSelect={handleLocationSelect}
				initialLocation={savedLocation || undefined}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
	},
	content: {
		flex: 1,
		padding: 16,
	},
	card: {
		borderRadius: 16,
		padding: 16,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginLeft: 8,
	},
	savedLocationContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	locationDetails: {
		flex: 1,
		marginRight: 12,
	},
	locationName: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 4,
	},
	locationAddress: {
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 8,
	},
	coordsContainer: {
		padding: 8,
		borderRadius: 8,
	},
	coordsText: {
		fontSize: 12,
		marginBottom: 2,
	},
	changeButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
	},
	changeButtonText: {
		fontSize: 14,
		fontWeight: '500',
		marginLeft: 4,
	},
	noLocationContainer: {
		alignItems: 'center',
		padding: 20,
	},
	noLocationIcon: {
		marginBottom: 12,
	},
	noLocationText: {
		fontSize: 16,
		marginBottom: 20,
		textAlign: 'center',
	},
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderRadius: 8,
	},
	addButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '500',
	},
	infoCard: {
		flexDirection: 'row',
		padding: 16,
		borderRadius: 12,
		alignItems: 'flex-start',
	},
	infoText: {
		flex: 1,
		marginLeft: 12,
		fontSize: 14,
		lineHeight: 20,
	},
});
