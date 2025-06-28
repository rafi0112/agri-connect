import {
	View,
	Text,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	Image,
	Alert,
	ActivityIndicator,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getFirestore, updateDoc, getDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function EditProfile() {
	const { user } = useAuth();
	const navigation = useNavigation();
	const db = getFirestore(app);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [profileImage, setProfileImage] = useState('');
	const [loading, setLoading] = useState(false);
	const [initialLoading, setInitialLoading] = useState(true);

	useEffect(() => {
		const fetchUserData = async () => {
			if (!user?.id) {
				setInitialLoading(false);
				return;
			}
			
			try {
				const docRef = doc(db, 'users', user.id);
				const userSnap = await getDoc(docRef);

				if (userSnap.exists()) {
					const data = userSnap.data();
					setName(data.name || user.name || '');
					setEmail(data.email || user.email || '');
					setPhone(data.phone || '');
					setProfileImage(data.profileImage || '');
				} else {
					// Set default values from auth user
					setName(user.name || '');
					setEmail(user.email || '');
				}
			} catch (error) {
				console.error('Error fetching user data:', error);
				Alert.alert('Error', 'Failed to load profile data');
			} finally {
				setInitialLoading(false);
			}
		};

		fetchUserData();
	}, [user]);

	const handleImagePick = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (permission.status !== 'granted') {
			return Alert.alert(
				'Permission Required', 
				'We need camera roll permissions to update your profile picture.',
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
				]
			);
		}

		Alert.alert(
			'Select Image',
			'Choose how you want to select your profile picture',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Camera', onPress: () => openCamera() },
				{ text: 'Gallery', onPress: () => openGallery() }
			]
		);
	};

	const openCamera = async () => {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (permission.status !== 'granted') {
			return Alert.alert('Permission denied', 'We need camera permissions.');
		}

		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.7,
		});

		if (!result.canceled && result.assets.length > 0) {
			setProfileImage(result.assets[0].uri);
		}
	};

	const openGallery = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.7,
		});

		if (!result.canceled && result.assets.length > 0) {
			setProfileImage(result.assets[0].uri);
		}
	};

	const handleSave = async () => {
		if (!user?.id) {
			Alert.alert('Error', 'User not found. Please login again.');
			return;
		}

		if (!name.trim() || !email.trim()) {
			return Alert.alert('Validation Error', 'Name and email are required.');
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return Alert.alert('Validation Error', 'Please enter a valid email address.');
		}

		setLoading(true);
		try {
			const updateData = {
				name: name.trim(),
				email: email.trim(),
				phone: phone.trim(),
				profileImage,
				updatedAt: new Date().toISOString(),
			};

			await updateDoc(doc(db, 'users', user.id), updateData);
			
			Alert.alert(
				'Success', 
				'Profile updated successfully!',
				[{ text: 'OK', onPress: () => navigation.goBack() }]
			);
		} catch (error) {
			console.error('Error updating profile:', error);
			Alert.alert('Error', 'Failed to update profile. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	if (initialLoading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#4CAF50" />
				<Text style={styles.loadingText}>Loading profile...</Text>
			</View>
		);
	}

	if (!user) {
		return (
			<View style={styles.errorContainer}>
				<Ionicons name="person-circle-outline" size={80} color="#ccc" />
				<Text style={styles.errorText}>Please login to edit your profile</Text>
			</View>
		);
	}

	return (
		<KeyboardAvoidingView 
			style={styles.container} 
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
		>
			<ScrollView 
				style={styles.scrollView}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity 
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Ionicons name="arrow-back" size={24} color="#333" />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Edit Profile</Text>
					<View style={styles.headerSpacer} />
				</View>

				{/* Profile Image Section */}
				<View style={styles.imageSection}>
					<TouchableOpacity 
						style={styles.imageContainer}
						onPress={handleImagePick}
					>
						<Image
							source={{
								uri: profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
							}}
							style={styles.profileImage}
						/>
						<View style={styles.imageOverlay}>
							<Ionicons name="camera" size={24} color="#fff" />
						</View>
					</TouchableOpacity>
					<Text style={styles.changePhotoText}>Tap to change photo</Text>
				</View>

				{/* Form Section */}
				<View style={styles.formSection}>
					<View style={styles.inputGroup}>
						<Text style={styles.inputLabel}>Full Name</Text>
						<View style={styles.inputContainer}>
							<Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
							<TextInput
								style={styles.input}
								placeholder="Enter your full name"
								value={name}
								onChangeText={setName}
								placeholderTextColor="#999"
							/>
						</View>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.inputLabel}>Email Address</Text>
						<View style={styles.inputContainer}>
							<Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
							<TextInput
								style={styles.input}
								placeholder="Enter your email"
								value={email}
								onChangeText={setEmail}
								keyboardType="email-address"
								autoCapitalize="none"
								placeholderTextColor="#999"
							/>
						</View>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.inputLabel}>Phone Number</Text>
						<View style={styles.inputContainer}>
							<Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
							<TextInput
								style={styles.input}
								placeholder="Enter your phone number"
								value={phone}
								onChangeText={setPhone}
								keyboardType="phone-pad"
								placeholderTextColor="#999"
							/>
						</View>
					</View>
				</View>

				{/* Save Button */}
				<TouchableOpacity
					style={[styles.saveButton, loading && styles.saveButtonDisabled]}
					onPress={handleSave}
					disabled={loading}
				>
					{loading ? (
						<View style={styles.loadingContent}>
							<ActivityIndicator color="#fff" size="small" />
							<Text style={styles.saveButtonText}>Saving...</Text>
						</View>
					) : (
						<View style={styles.buttonContent}>
							<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
							<Text style={styles.saveButtonText}>Save Changes</Text>
						</View>
					)}
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f7fa',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#f5f7fa',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#666',
	},
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#f5f7fa',
	},
	errorText: {
		marginTop: 16,
		fontSize: 16,
		color: '#666',
		textAlign: 'center',
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 40,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingTop: 60,
		paddingBottom: 20,
		backgroundColor: '#fff',
	},
	backButton: {
		padding: 8,
		borderRadius: 20,
		backgroundColor: '#f8f9fa',
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#1a1a1a',
		marginLeft: 16,
	},
	headerSpacer: {
		flex: 1,
	},
	imageSection: {
		alignItems: 'center',
		paddingVertical: 32,
		backgroundColor: '#fff',
		marginBottom: 20,
	},
	imageContainer: {
		position: 'relative',
		marginBottom: 12,
	},
	profileImage: {
		width: 120,
		height: 120,
		borderRadius: 60,
		borderWidth: 4,
		borderColor: '#fff',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	imageOverlay: {
		position: 'absolute',
		bottom: 0,
		right: 0,
		backgroundColor: '#4CAF50',
		borderRadius: 20,
		padding: 10,
		borderWidth: 3,
		borderColor: '#fff',
	},
	changePhotoText: {
		fontSize: 14,
		color: '#4CAF50',
		fontWeight: '600',
	},
	formSection: {
		backgroundColor: '#fff',
		marginHorizontal: 16,
		borderRadius: 16,
		padding: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	inputGroup: {
		marginBottom: 20,
	},
	inputLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1a1a1a',
		marginBottom: 8,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#f8f9fa',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e9ecef',
		paddingHorizontal: 16,
		paddingVertical: 4,
	},
	inputIcon: {
		marginRight: 12,
	},
	input: {
		flex: 1,
		fontSize: 16,
		color: '#1a1a1a',
		paddingVertical: 12,
	},
	saveButton: {
		backgroundColor: '#4CAF50',
		marginHorizontal: 16,
		marginTop: 32,
		paddingVertical: 16,
		borderRadius: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	saveButtonDisabled: {
		backgroundColor: '#a5d6a7',
	},
	buttonContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	saveButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
		marginLeft: 8,
	},
	// Legacy styles for compatibility
	changePhoto: {
		textAlign: 'center',
		color: '#4CAF50',
		marginBottom: 20,
	},
});
