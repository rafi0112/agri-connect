import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';

export default function ShippingAddressScreen() {
	const { user } = useAuth();
	const db = getFirestore(app);
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
		latitudeDelta: number;
		longitudeDelta: number;
	} | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);

	useEffect(() => {
		(async () => {
			let { status } = await Location.requestForegroundPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert(
					'Permission Denied',
					'Location permission is required to select an address.'
				);
				return;
			}

			let currentLocation = await Location.getCurrentPositionAsync({});
			setLocation({
				latitude: currentLocation.coords.latitude,
				longitude: currentLocation.coords.longitude,
				latitudeDelta: 0.01,
				longitudeDelta: 0.01,
			});
		})();
	}, []);

	const handleSaveAddress = async () => {
		if (!selectedLocation) {
			Alert.alert(
				'No Address Selected',
				'Please select an address on the map.'
			);
			return;
		}

		try {
			if (!user) {
				Alert.alert('Error', 'User is not logged in.');
				return;
			}

			await setDoc(
				doc(db, 'users', user.id),
				{ shippingAddress: selectedLocation },
				{ merge: true }
			);
			Alert.alert('Success', 'Shipping address saved successfully!');
		} catch (error) {
			console.error('Error saving address:', error);
			Alert.alert('Error', 'Failed to save the address.');
		}
	};

	return (
		<View style={styles.container}>
			{location ? (
				<MapView
					style={styles.map}
					initialRegion={location}
					onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
				>
					{selectedLocation && (
						<Marker coordinate={selectedLocation} title='Selected Location' />
					)}
				</MapView>
			) : (
				<Text style={styles.loadingText}>Loading map...</Text>
			)}

			<TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress}>
				<Text style={styles.saveButtonText}>Save Address</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	map: {
		flex: 1,
	},
	loadingText: {
		flex: 1,
		textAlign: 'center',
		textAlignVertical: 'center',
		fontSize: 16,
		color: '#666',
	},
	saveButton: {
		backgroundColor: '#4CAF50',
		padding: 16,
		alignItems: 'center',
	},
	saveButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
});
