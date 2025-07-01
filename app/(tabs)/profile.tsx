import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Image,
	Alert,
	useColorScheme,
	Dimensions,
	StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialIcons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
	const { user, logout } = useAuth();
	const navigation = useNavigation();
	const [orderCount, setOrderCount] = useState(0);
	const [userProfile, setUserProfile] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const db = getFirestore(app);
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];

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
		<View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
			<StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
			
			<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
				{/* Modern Header with Gradient Effect */}
				<View style={styles.headerContainer}>
					<LinearGradient
						colors={[colors.primary, colors.primaryLight]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={styles.headerGradient}
					>
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
									<Text style={styles.statusText}>Active Farmer</Text>
								</View>
							</View>
						</View>
					</LinearGradient>

					{/* Stats Cards */}
					<View style={styles.statsContainer}>
						<LinearGradient
							colors={[`${colors.card}`, `${colors.card}`]}
							style={[styles.statCard, { shadowColor: colors.shadowColor }]}
							start={{ x: 0, y: 0 }}
							end={{ x: 0, y: 1 }}
						>
							<View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
								<Ionicons name='receipt-outline' size={24} color={colors.primary} />
							</View>
							<Text style={[styles.statNumber, { color: colors.text }]}>{orderCount}</Text>
							<Text style={[styles.statLabel, { color: colors.textLight }]}>Orders</Text>
						</LinearGradient>
						
						<LinearGradient
							colors={[`${colors.card}`, `${colors.card}`]}
							style={[styles.statCard, { shadowColor: colors.shadowColor }]}
							start={{ x: 0, y: 0 }}
							end={{ x: 0, y: 1 }}
						>
							<View style={[styles.statIconContainer, { backgroundColor: `${colors.warning}15` }]}>
								<Ionicons name='star-outline' size={24} color={colors.warning} />
							</View>
							<Text style={[styles.statNumber, { color: colors.text }]}>4.8</Text>
							<Text style={[styles.statLabel, { color: colors.textLight }]}>Rating</Text>
						</LinearGradient>
						
						<LinearGradient
							colors={[`${colors.card}`, `${colors.card}`]}
							style={[styles.statCard, { shadowColor: colors.shadowColor }]}
							start={{ x: 0, y: 0 }}
							end={{ x: 0, y: 1 }}
						>
							<View style={[styles.statIconContainer, { backgroundColor: `${colors.info}15` }]}>
								<Ionicons name='trophy-outline' size={24} color={colors.info} />
							</View>
							<Text style={[styles.statNumber, { color: colors.text }]}>120</Text>
							<Text style={[styles.statLabel, { color: colors.textLight }]}>Points</Text>
						</LinearGradient>
					</View>
				</View>

				{/* Menu Options */}
				<View style={[styles.menuContainer, { backgroundColor: colors.card }]}>
					<Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
					
					{/* Orders Link */}
					<Link href='/orders' asChild>
						<TouchableOpacity style={styles.menuItem}>
							<View style={[styles.menuIconContainer, { backgroundColor: `${colors.primary}15` }]}>
								<Ionicons name='receipt' size={22} color={colors.primary} />
							</View>
							<View style={styles.menuContent}>
								<Text style={[styles.menuText, { color: colors.text }]}>My Orders</Text>
								<Text style={[styles.menuSubtext, { color: colors.textLight }]}>View your order history</Text>
							</View>
							<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
						</TouchableOpacity>
					</Link>

					<TouchableOpacity
						style={styles.menuItem}
						onPress={() => navigation.navigate('Address' as never)}
					>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.info}15` }]}>
							<Ionicons name='location' size={22} color={colors.info} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Delivery Address</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Manage your addresses</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.menuItem}
						onPress={() => navigation.navigate('Payments' as never)}
					>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.warning}15` }]}>
							<FontAwesome name='credit-card' size={20} color={colors.warning} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Payment Methods</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Manage payment options</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
				</View>

				{/* Agricultural Hub Section */}
				<View style={[styles.menuContainer, { backgroundColor: colors.card }]}>
					<Text style={[styles.sectionTitle, { color: colors.text }]}>Agricultural Hub</Text>
					
					<TouchableOpacity style={styles.menuItem}>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.accent}15` }]}>
							<MaterialCommunityIcons name='seed' size={22} color={colors.accent} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Seasonal Calendar</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Planting and harvesting guides</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
					
					<TouchableOpacity style={styles.menuItem}>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.secondary}15` }]}>
							<MaterialCommunityIcons name='weather-partly-cloudy' size={22} color={colors.secondary} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Weather Alerts</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Set up local weather notifications</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
					
					<TouchableOpacity style={styles.menuItem}>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.yellow}15` }]}>
							<MaterialCommunityIcons name='account-group' size={22} color={colors.yellow} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Farmer Community</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Connect with local farmers</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
				</View>

				{/* Developer Section */}
				<View style={[styles.menuContainer, { backgroundColor: colors.card }]}>
					<Text style={[styles.sectionTitle, { color: colors.text }]}>Developer Tools</Text>
					
					<TouchableOpacity
						style={styles.menuItem}
						onPress={() => navigation.navigate('payment/testing' as never)}
					>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.error}15` }]}>
							<MaterialIcons name='payment' size={22} color={colors.error} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Payment Testing</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Test online payment functionality</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
				</View>

				{/* Settings Section */}
				<View style={[styles.menuContainer, { backgroundColor: colors.card }]}>
					<Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
					
					<TouchableOpacity
						style={styles.menuItem}
						onPress={() => navigation.navigate('Settings' as never)}
					>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.textLight}15` }]}>
							<Ionicons name='settings-outline' size={22} color={colors.textLight} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>App Settings</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Notifications, appearance, language</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
					
					<TouchableOpacity
						style={styles.menuItem}
						onPress={() => navigation.navigate('Help' as never)}
					>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.info}15` }]}>
							<Ionicons name='help-circle-outline' size={22} color={colors.info} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.text }]}>Help & Support</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>FAQs, contact support</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
					
					<TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
						<View style={[styles.menuIconContainer, { backgroundColor: `${colors.error}15` }]}>
							<Ionicons name='log-out-outline' size={22} color={colors.error} />
						</View>
						<View style={styles.menuContent}>
							<Text style={[styles.menuText, { color: colors.error }]}>Logout</Text>
							<Text style={[styles.menuSubtext, { color: colors.textLight }]}>Sign out of your account</Text>
						</View>
						<Ionicons name='chevron-forward' size={20} color={colors.textLight} />
					</TouchableOpacity>
				</View>
				
				{/* App Version Footer */}
				<View style={styles.footerContainer}>
					<Image 
						source={require('../../assets/images/react-logo.png')} 
						style={styles.footerLogo} 
						resizeMode="contain"
					/>
					<Text style={[styles.versionText, { color: colors.textLight }]}>AgriConnect v1.0.0</Text>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	mainContainer: {
		flex: 1,
	},
	container: {
		flex: 1,
	},
	headerContainer: {
		marginBottom: 24,
	},
	headerGradient: {
		borderBottomLeftRadius: 30,
		borderBottomRightRadius: 30,
		paddingTop: 60,
		paddingBottom: 100, // Extra space for stats overlap
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 10,
	},
	profileSection: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
	},
	profileImageContainer: {
		position: 'relative',
		marginRight: 16,
	},
	profileImage: {
		width: 80,
		height: 80,
		borderRadius: 40,
		borderWidth: 3,
		borderColor: '#ffffff',
	},
	editIconContainer: {
		position: 'absolute',
		bottom: 0,
		right: 0,
		backgroundColor: '#4CAF50',
		borderRadius: 15,
		width: 28,
		height: 28,
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 2,
		borderColor: '#ffffff',
	},
	userInfo: {
		flex: 1,
	},
	userName: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#ffffff',
		marginBottom: 4,
		textShadowColor: 'rgba(0, 0, 0, 0.2)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	userEmail: {
		fontSize: 14,
		color: 'rgba(255, 255, 255, 0.8)',
		marginBottom: 8,
	},
	statusBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: 12,
		alignSelf: 'flex-start',
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#4AFF59',
		marginRight: 6,
	},
	statusText: {
		fontSize: 12,
		color: '#ffffff',
		fontWeight: '600',
	},
	statsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		marginTop: -50,
	},
	statCard: {
		width: (width - 48) / 3,
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 16,
		alignItems: 'center',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 4,
	},
	statIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 8,
	},
	statNumber: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	statLabel: {
		fontSize: 12,
		fontWeight: '500',
	},
	menuContainer: {
		borderRadius: 20,
		marginHorizontal: 16,
		marginBottom: 24,
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 3,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 16,
		marginLeft: 8,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.05)',
	},
	menuIconContainer: {
		width: 42,
		height: 42,
		borderRadius: 21,
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
		marginBottom: 3,
	},
	menuSubtext: {
		fontSize: 13,
	},
	devMenuItem: {
		backgroundColor: 'rgba(255, 87, 34, 0.05)',
		borderRadius: 12,
		marginTop: 8,
	},
	devIconContainer: {
		backgroundColor: 'rgba(255, 87, 34, 0.15)',
	},
	footerContainer: {
		alignItems: 'center',
		paddingVertical: 24,
		marginBottom: 32,
	},
	footerLogo: {
		width: 40,
		height: 40,
		marginBottom: 12,
		opacity: 0.8,
	},
	versionText: {
		fontSize: 14,
	},
});
