import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Image,
	Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
	collection,
	query,
	where,
	getDocs,
	getFirestore,
	doc,
	getDoc,
} from 'firebase/firestore';
import { app } from '../../config/firebase';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
	const { user, logout } = useAuth();
	const navigation = useNavigation();
	const [orderCount, setOrderCount] = useState(0);
	const [userProfile, setUserProfile] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const db = getFirestore(app);

	useEffect(() => {
		const fetchUserData = async () => {
			if (!user?.id) return;
			
			try {
				// Fetch user profile data
				const userDocRef = doc(db, 'users', user.id);
				const userDoc = await getDoc(userDocRef);
				
				if (userDoc.exists()) {
					setUserProfile(userDoc.data());
				}

				// Fetch order count
				const ordersRef = collection(db, 'orders');
				const q = query(ordersRef, where('userId', '==', user.id));
				const querySnapshot = await getDocs(q);
				setOrderCount(querySnapshot.size);
			} catch (error) {
				console.error('Error fetching user data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchUserData();
	}, [user?.id]);

	const handleLogout = () => {
		Alert.alert(
			'Logout',
			'Are you sure you want to logout?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Logout', style: 'destructive', onPress: logout },
			]
		);
	};

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			{/* Modern Header with Gradient Effect */}
			<View style={styles.headerContainer}>
				<View style={styles.headerGradient}>
					<View style={styles.profileSection}>
						<TouchableOpacity
							style={styles.profileImageContainer}
							onPress={() => navigation.navigate('EditProfile' as never)}
						>
							<Image
								source={{ 
									uri: userProfile?.profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face' 
								}}
								style={styles.profileImage}
							/>
							<View style={styles.editIconContainer}>
								<Ionicons name='camera' size={16} color='#fff' />
							</View>
						</TouchableOpacity>
						
						<View style={styles.userInfo}>
							<Text style={styles.userName}>{userProfile?.name || user?.name || 'User'}</Text>
							<Text style={styles.userEmail}>{user?.email}</Text>
							<View style={styles.statusBadge}>
								<View style={styles.statusDot} />
								<Text style={styles.statusText}>Active</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Stats Cards */}
				<View style={styles.statsContainer}>
					<View style={styles.statCard}>
						<View style={styles.statIconContainer}>
							<Ionicons name='receipt-outline' size={24} color='#4CAF50' />
						</View>
						<Text style={styles.statNumber}>{orderCount}</Text>
						<Text style={styles.statLabel}>Orders</Text>
					</View>
					<View style={styles.statCard}>
						<View style={styles.statIconContainer}>
							<Ionicons name='star-outline' size={24} color='#FF9800' />
						</View>
						<Text style={styles.statNumber}>4.8</Text>
						<Text style={styles.statLabel}>Rating</Text>
					</View>
					<View style={styles.statCard}>
						<View style={styles.statIconContainer}>
							<Ionicons name='trophy-outline' size={24} color='#2196F3' />
						</View>
						<Text style={styles.statNumber}>120</Text>
						<Text style={styles.statLabel}>Points</Text>
					</View>
				</View>
			</View>

			{/* Menu Options */}
			<View style={styles.menuContainer}>
				<Text style={styles.sectionTitle}>Account</Text>
				
				{/* Orders Link */}
				<Link href='/orders' asChild>
					<TouchableOpacity style={styles.menuItem}>
						<View style={styles.menuIconContainer}>
							<Ionicons name='receipt' size={22} color='#4CAF50' />
						</View>
						<View style={styles.menuContent}>
							<Text style={styles.menuText}>My Orders</Text>
							<Text style={styles.menuSubtext}>View your order history</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color='#999' />
					</TouchableOpacity>
				</Link>

				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => navigation.navigate('Address' as never)}
				>
					<View style={styles.menuIconContainer}>
						<Ionicons name='location' size={22} color='#2196F3' />
					</View>
					<View style={styles.menuContent}>
						<Text style={styles.menuText}>Delivery Address</Text>
						<Text style={styles.menuSubtext}>Manage your addresses</Text>
					</View>
					<Ionicons name='chevron-forward' size={20} color='#999' />
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => navigation.navigate('Payments' as never)}
				>
					<View style={styles.menuIconContainer}>
						<FontAwesome name='credit-card' size={20} color='#FF9800' />
					</View>
					<View style={styles.menuContent}>
						<Text style={styles.menuText}>Payment Methods</Text>
						<Text style={styles.menuSubtext}>Manage payment options</Text>
					</View>
					<Ionicons name='chevron-forward' size={20} color='#999' />
				</TouchableOpacity>
			</View>

			{/* Developer Section */}
			<View style={styles.menuContainer}>
				<Text style={styles.sectionTitle}>Developer Tools</Text>
				
				<TouchableOpacity
					style={[styles.menuItem, styles.devMenuItem]}
					onPress={() => navigation.navigate('payment/testing' as never)}
				>
					<View style={[styles.menuIconContainer, styles.devIconContainer]}>
						<MaterialIcons name='payment' size={22} color='#FF5722' />
					</View>
					<View style={styles.menuContent}>
						<Text style={styles.menuText}>Payment Testing</Text>
						<Text style={styles.menuSubtext}>Test online payment functionality</Text>
					</View>
					<Ionicons name='chevron-forward' size={20} color='#999' />
				</TouchableOpacity>
			</View>

			{/* Settings Section */}
			<View style={styles.menuContainer}>
				<Text style={styles.sectionTitle}>Settings</Text>
				
				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => navigation.navigate('Settings' as never)}
				>
					<View style={styles.menuIconContainer}>
						<Ionicons name='settings' size={22} color='#9C27B0' />
					</View>
					<View style={styles.menuContent}>
						<Text style={styles.menuText}>App Settings</Text>
						<Text style={styles.menuSubtext}>Customize your experience</Text>
					</View>
					<Ionicons name='chevron-forward' size={20} color='#999' />
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => navigation.navigate('Help' as never)}
				>
					<View style={styles.menuIconContainer}>
						<MaterialIcons name='help-outline' size={22} color='#607D8B' />
					</View>
					<View style={styles.menuContent}>
						<Text style={styles.menuText}>Help & Support</Text>
						<Text style={styles.menuSubtext}>Get help and support</Text>
					</View>
					<Ionicons name='chevron-forward' size={20} color='#999' />
				</TouchableOpacity>
			</View>

			{/* Logout Button */}
			<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
				<View style={styles.logoutIconContainer}>
					<Ionicons name='log-out' size={22} color='#F44336' />
				</View>
				<Text style={styles.logoutText}>Logout</Text>
			</TouchableOpacity>

			<View style={styles.bottomPadding} />
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f7fa',
	},
	headerContainer: {
		backgroundColor: '#fff',
		marginBottom: 20,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	headerGradient: {
		padding: 24,
		paddingTop: 40,
	},
	profileSection: {
		alignItems: 'center',
		marginBottom: 32,
	},
	profileImageContainer: {
		position: 'relative',
		marginBottom: 16,
	},
	profileImage: {
		width: 100,
		height: 100,
		borderRadius: 50,
		borderWidth: 4,
		borderColor: '#fff',
	},
	editIconContainer: {
		position: 'absolute',
		bottom: 0,
		right: 0,
		backgroundColor: '#4CAF50',
		borderRadius: 20,
		padding: 8,
		borderWidth: 3,
		borderColor: '#fff',
	},
	userInfo: {
		alignItems: 'center',
	},
	userName: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#1a1a1a',
		marginBottom: 4,
	},
	userEmail: {
		fontSize: 16,
		color: '#666',
		marginBottom: 8,
	},
	statusBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#e8f5e8',
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 16,
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#4CAF50',
		marginRight: 6,
	},
	statusText: {
		fontSize: 12,
		color: '#4CAF50',
		fontWeight: '600',
	},
	statsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		paddingHorizontal: 16,
	},
	statCard: {
		backgroundColor: '#f8f9fa',
		borderRadius: 16,
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 20,
		minWidth: 80,
	},
	statIconContainer: {
		marginBottom: 8,
	},
	statNumber: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#1a1a1a',
		marginBottom: 4,
	},
	statLabel: {
		fontSize: 12,
		color: '#666',
		fontWeight: '500',
	},
	menuContainer: {
		backgroundColor: '#fff',
		marginHorizontal: 16,
		marginBottom: 20,
		borderRadius: 16,
		paddingVertical: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#1a1a1a',
		paddingHorizontal: 20,
		paddingVertical: 16,
		paddingBottom: 8,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f2f5',
	},
	menuIconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#f8f9fa',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 16,
	},
	menuContent: {
		flex: 1,
	},
	menuText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1a1a1a',
		marginBottom: 2,
	},
	menuSubtext: {
		fontSize: 13,
		color: '#666',
	},
	devMenuItem: {
		backgroundColor: '#fff3e0',
		marginHorizontal: 16,
		marginVertical: 4,
		borderRadius: 12,
		borderBottomWidth: 0,
	},
	devIconContainer: {
		backgroundColor: '#ffebee',
	},
	logoutButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#fff',
		marginHorizontal: 16,
		marginBottom: 20,
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#ffebee',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	logoutIconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#ffebee',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 16,
	},
	logoutText: {
		fontSize: 16,
		color: '#F44336',
		fontWeight: '600',
	},
	bottomPadding: {
		height: 100,
	},
	// Legacy styles for compatibility
	header: {
		alignItems: 'center',
		paddingVertical: 30,
		backgroundColor: '#fff',
		marginBottom: 10,
	},
	name: {
		fontSize: 22,
		fontWeight: 'bold',
		marginBottom: 5,
	},
	email: {
		fontSize: 16,
		color: '#666',
	},
	editIcon: {
		position: 'absolute',
		top: 10,
		right: 10,
		backgroundColor: '#fff',
		borderRadius: 20,
		padding: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	statItem: {
		alignItems: 'center',
	},
	optionsContainer: {
		backgroundColor: '#fff',
		marginBottom: 20,
	},
	optionItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 18,
		paddingHorizontal: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f0f0',
	},
	optionIcon: {
		width: 30,
		marginRight: 15,
	},
	optionText: {
		flex: 1,
		fontSize: 16,
	},
});
