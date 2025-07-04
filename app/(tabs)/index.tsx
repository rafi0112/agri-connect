import { useState, useEffect, useCallback, useRef } from 'react';
import {
	View,
	Text,
	FlatList,
	Image,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	TextInput,
	ScrollView,
	useColorScheme,
	RefreshControl,
	Platform,
	Dimensions,
	StatusBar,
	Animated,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { app } from '../../config/firebase';
import {
	Ionicons,
	MaterialIcons,
	FontAwesome,
	MaterialCommunityIcons,
	AntDesign,
} from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
// Use almost full width for single column cards with padding
const CARD_WIDTH = width - 40; // 20px padding on each side
const CARD_HEIGHT = CARD_WIDTH * 0.65; // Reduced height ratio for single row cards

type Product = {
	id: string;
	name: string;
	price: number;
	image: string;
	shopId: string;
	shopName?: string;
	unit: string;
	type: string;
	likes?: number;
	stock?: number;
	farmerId?: string;
};

type WeatherData = {
	temp: number;
	description: string;
	icon:
		| 'sunny'
		| 'moon'
		| 'partly-sunny'
		| 'cloudy-night'
		| 'cloud'
		| 'cloudy'
		| 'rainy'
		| 'thunderstorm'
		| 'snow';
	city: string;
};

type Category = {
	name: string;
	icon: JSX.Element;
	color: string;
};

export default function HomeScreen() {
	const { user } = useAuth();
	const [products, setProducts] = useState<Product[]>([]);
	const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [weatherLoading, setWeatherLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<string>('all');
	const [categories, setCategories] = useState<Category[]>([]);
	const db = getFirestore(app);
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];

	const OPENWEATHER_API_KEY = 'd734f951c52155a9771143721b7eb908';

// Animated Product Card Component
const AnimatedProductCard = ({ children, index }: { children: React.ReactNode; index: number }) => {
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const translateY = useRef(new Animated.Value(50)).current;

	useEffect(() => {
		Animated.parallel([
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 500,
				delay: index * 100,
				useNativeDriver: true,
			}),
			Animated.timing(translateY, {
				toValue: 0,
				duration: 500,
				delay: index * 100,
				useNativeDriver: true,
			})
		]).start();
	}, []);

	return (
		<Animated.View
			style={{
				opacity: fadeAnim,
				transform: [{ translateY }],
				marginBottom: 16,
			}}
		>
			{children}
		</Animated.View>
	);
};

// Updated the getCategoryIcon function with a cleaner and more consistent style
	const getCategoryIcon = (categoryName: string): { icon: JSX.Element, color: string } => {
		const iconOptions = [
			{ icon: <MaterialCommunityIcons name='seed' size={24} color='#FFFFFF' />, color: colors.primary },
			{ icon: <MaterialCommunityIcons name='leaf' size={24} color='#FFFFFF' />, color: colors.success },
			{ icon: <MaterialCommunityIcons name='food-apple-outline' size={24} color='#FFFFFF' />, color: colors.orange },
			{ icon: <MaterialCommunityIcons name='carrot' size={24} color='#FFFFFF' />, color: colors.warning },
			{ icon: <MaterialCommunityIcons name='fruit-watermelon' size={24} color='#FFFFFF' />, color: colors.accent },
			{ icon: <MaterialCommunityIcons name='fruit-cherries' size={24} color='#FFFFFF' />, color: colors.secondary },
			{ icon: <MaterialCommunityIcons name='corn' size={24} color='#FFFFFF' />, color: colors.info },
			{ icon: <Ionicons name='nutrition-outline' size={24} color='#FFFFFF' />, color: colors.highlight },
			{ icon: <MaterialCommunityIcons name='silo' size={24} color='#FFFFFF' />, color: '#8D6E63' },
			{ icon: <FontAwesome name='pagelines' size={24} color='#FFFFFF' />, color: colors.primaryDark },
		];

		// Special case for 'all' category
		if (categoryName === 'all') {
			return { 
				icon: <MaterialIcons name='category' size={24} color='#FFFFFF' />,
				color: colors.primaryDark
			};
		}

		// Generate a consistent index based on the category name
		const nameSum = categoryName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
		const index = nameSum % iconOptions.length;
		
		return iconOptions[index];
	};

	// Function to fetch shop names
	const fetchShopNames = async (products: Product[]): Promise<Product[]> => {
		try {
			// Get unique shop IDs to avoid duplicate queries
			const shopIds = [...new Set(products.map(product => product.shopId).filter(id => id))];
			
			if (shopIds.length === 0) return products;
			
			// Create a map to store shop names
			const shopNameMap: {[key: string]: string} = {};
			
			// Fetch shop documents
			const shopsQuerySnapshot = await getDocs(collection(db, 'shops'));
			
			shopsQuerySnapshot.forEach(doc => {
				const shopData = doc.data();
				shopNameMap[doc.id] = shopData.name || "Farmer's Market";
			});
			
			// Update products with shop names
			return products.map(product => ({
				...product,
				shopName: product.shopId && shopNameMap[product.shopId] 
					? shopNameMap[product.shopId] 
					: product.shopName || "Farmer's Market"
			}));
		} catch (error) {
			console.error('Error fetching shop names:', error);
			return products;
		}
	};

	useEffect(() => {
		const fetchProducts = async () => {
			try {
				const querySnapshot = await getDocs(collection(db, 'products'));
				const productsData: Product[] = [];
				const uniqueCategories = new Set<string>(['all']);

				querySnapshot.forEach((doc) => {
					const data = doc.data();
					const productType = data.type || 'general';
					productsData.push({
						id: doc.id,
						name: data.name || 'No Name',
						price: data.price || 0,
						image: data.image || 'https://via.placeholder.com/150',
						shopId: data.shopId || '',
						shopName: data.shopName,
						unit: data.unit || '',
						type: productType,
						likes: data.likes || 0,
						stock: data.stock || 0,
						farmerId: data.farmerId || '',
					});
					uniqueCategories.add(productType);
				});

				// Sort products by likes in descending order
				const sortedProducts = productsData.sort((a, b) => (b.likes || 0) - (a.likes || 0));

				// Create category objects with icons and colors
				const categoryList: Category[] = Array.from(uniqueCategories).map(
					(cat) => {
						const iconData = getCategoryIcon(cat);
						return {
							name: cat,
							icon: iconData.icon,
							color: iconData.color
						};
					}
				);

				// Fetch shop names for products
				const productsWithShopNames = await fetchShopNames(sortedProducts);
				
				setProducts(productsWithShopNames);
				setFilteredProducts(productsWithShopNames);
				setCategories(categoryList);
			} catch (error) {
				console.error('Error fetching products:', error);
			} finally {
				setLoading(false);
			}
		};

		const fetchWeather = async () => {
			try {
				const city = 'Dhaka';
				const response = await fetch(
					`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`
				);
				const data = await response.json();

				if (data.cod === 200) {
					setWeather({
						temp: Math.round(data.main.temp),
						description: data.weather[0].description,
						icon: mapWeatherIcon(data.weather[0].icon) as WeatherData['icon'],
						city: data.name,
					});
				} else {
					console.error('Weather API error:', data.message);
				}
			} catch (error) {
				console.error('Error fetching weather:', error);
			} finally {
				setWeatherLoading(false);
			}
		};

		fetchProducts();
		fetchWeather();
	}, []);

	useEffect(() => {
		let filtered = [...products];

		// Apply category filter
		if (selectedCategory !== 'all') {
			filtered = filtered.filter(
				(product) => product.type === selectedCategory
			);
		}

		// Apply search filter
		if (searchQuery.trim() !== '') {
			filtered = filtered.filter((product) =>
				product.name.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Ensure products are sorted by likes even after filtering
		filtered = filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));

		setFilteredProducts(filtered);
	}, [searchQuery, products, selectedCategory]);

	const mapWeatherIcon = (iconCode: string) => {
		// Map OpenWeather icon codes to Ionicons
		const mapping: { [key: string]: WeatherData['icon'] } = {
			'01d': 'sunny',
			'01n': 'moon',
			'02d': 'partly-sunny',
			'02n': 'cloudy-night',
			'03d': 'cloud',
			'03n': 'cloud',
			'04d': 'cloudy',
			'04n': 'cloudy',
			'09d': 'rainy',
			'09n': 'rainy',
			'10d': 'rainy',
			'10n': 'rainy',
			'11d': 'thunderstorm',
			'11n': 'thunderstorm',
			'13d': 'snow',
			'13n': 'snow',
			'50d': 'cloud',
			'50n': 'cloud',
		};

		return mapping[iconCode] || 'cloud';
	};

	const handleCategoryPress = (category: string) => {
		setSelectedCategory(category);
	};

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			const querySnapshot = await getDocs(collection(db, 'products'));
			const productsData: Product[] = [];
			const uniqueCategories = new Set<string>(['all']);

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				const productType = data.type || 'general';
				productsData.push({
					id: doc.id,
					name: data.name || 'No Name',
					price: data.price || 0,
					image: data.image || 'https://via.placeholder.com/150',
					shopId: data.shopId || '',
					shopName: data.shopName,
					unit: data.unit || '',
					type: productType,
					likes: data.likes || 0,
					stock: data.stock || 0,
					farmerId: data.farmerId || '',
				});
				uniqueCategories.add(productType);
			});

			// Sort products by likes in descending order
			const sortedProducts = productsData.sort((a, b) => (b.likes || 0) - (a.likes || 0));

			// Create category objects with icons and colors
			const categoryList: Category[] = Array.from(uniqueCategories).map(
				(cat) => {
					const iconData = getCategoryIcon(cat);
					return {
						name: cat,
						icon: iconData.icon,
						color: iconData.color
					};
				}
			);
			
			// Fetch shop names for products
			const productsWithShopNames = await fetchShopNames(sortedProducts);

			setProducts(productsWithShopNames);
			setFilteredProducts(productsWithShopNames);
			setCategories(categoryList);
		} catch (error) {
			console.error('Error refreshing products:', error);
		} finally {
			setRefreshing(false);
		}
	}, [db]);

	if (loading) {
		return (
			<View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
				<ActivityIndicator size='large' color={colors.primary} />
				<Text style={[styles.loadingText, {color: colors.textSecondary}]}>Loading products...</Text>
			</View>
		);
	}

	// Limit the number of featured products to 6
	const featuredProducts = filteredProducts.slice(0, 6);

	return (
		<ScrollView 
			style={[styles.container, {backgroundColor: colors.background}]} 
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: 20 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={onRefresh}
					colors={[colors.primary, colors.accent]}
					tintColor={colors.primary}
				/>
			}
		>
			<StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
			
			{/* Header Section */}
			<View style={styles.headerContainer}>
				<LinearGradient
					colors={[colors.primary, colors.primaryDark]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0.8 }}
					style={styles.headerGradient}
				>
					<View style={styles.headerContent}>
						<View style={styles.headerTopRow}>
							<View>
								<Text style={styles.welcomeText}>Welcome back,</Text>
								<Text style={styles.userName}>{user?.name || 'Guest'}</Text>
							</View>
							
							<Link href='/profile' asChild>
								<TouchableOpacity style={styles.profileButton}>
									<Ionicons name='person' size={22} color='#fff' />
								</TouchableOpacity>
							</Link>
						</View>
						
						{weather && (
							<View style={styles.weatherCard}>
								<View style={styles.weatherIconContainer}>
									<Ionicons
										name={weather.icon ? (`${weather.icon}` as const) : 'cloud'}
										size={20}
										color={colors.primaryDark}
									/>
								</View>
								<Text style={styles.weatherTemp}>{weather.temp}°C</Text>
								<Text style={styles.weatherCity}>{weather.city}</Text>
							</View>
						)}
					</View>
				</LinearGradient>
			</View>

			{/* Main Content Section */}
			<View style={styles.mainContent}>
				{/* Search Bar */}
				<View style={[styles.searchContainer, {backgroundColor: colors.card, borderColor: colors.border}]}>
					<View style={styles.searchIconContainer}>
						<Ionicons name='search' size={20} color={colors.primary} />
					</View>
					<TextInput
						placeholder='Search fresh produce...'
						placeholderTextColor={colors.textMuted}
						style={[styles.searchInput, {color: colors.text}]}
						value={searchQuery}
						onChangeText={setSearchQuery}
					/>
					{searchQuery.length > 0 && (
						<TouchableOpacity 
							onPress={() => setSearchQuery('')}
							style={styles.clearSearchButton}
						>
							<Ionicons name="close-circle" size={18} color={colors.textMuted} />
						</TouchableOpacity>
					)}
				</View>

				{/* Categories Section */}
				<View style={styles.sectionContainer}>
					<View style={styles.sectionHeader}>
						<Text style={[styles.sectionTitle, {color: colors.text}]}>Categories</Text>
						<View style={[styles.sortIndicator, {backgroundColor: colors.errorLight}]}>
							<Ionicons name="heart" size={14} color={colors.error} />
							<Text style={[styles.sortText, {color: colors.error}]}>Top liked</Text>
						</View>
					</View>
					
					<FlatList
						data={categories}
						horizontal
						showsHorizontalScrollIndicator={false}
						keyExtractor={(item) => item.name}
						contentContainerStyle={styles.categoriesList}
						renderItem={({ item }) => (
							<TouchableOpacity
								style={[
									styles.categoryCard,
									{ 
										backgroundColor: selectedCategory === item.name 
											? item.color 
											: `${colors.card}`
									},
									selectedCategory === item.name && styles.selectedCategoryCard
								]}
								onPress={() => handleCategoryPress(item.name)}
								activeOpacity={0.7}
							>
								<View 
									style={[
										styles.categoryIcon,
										{ 
											backgroundColor: selectedCategory === item.name 
												? 'rgba(255,255,255,0.3)' 
												: item.color
										}
									]}
								>
									{item.icon}
								</View>
								<Text
									style={[
										styles.categoryLabel,
										{ color: selectedCategory === item.name ? '#fff' : colors.text }
									]}
								>
									{item.name.charAt(0).toUpperCase() + item.name.slice(1)}
								</Text>
								{selectedCategory === item.name && (
									<View style={styles.categorySelectedIndicator} />
								)}
							</TouchableOpacity>
						)}
					/>
				</View>

				{/* Featured Products Section */}
				<View style={styles.sectionContainer}>
					<View style={styles.sectionHeader}>
						<View>
							<Text style={[styles.sectionTitle, {color: colors.text, fontSize: 24, fontWeight: '700'}]}>
								Featured Products
							</Text>
							<Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>Fresh from the farm</Text>
						</View>
						
						<View style={[styles.sortIndicator, {backgroundColor: colors.primaryLight + '20'}]}>
							<Ionicons name="star" size={14} color={colors.primary} />
							<Text style={[styles.sortText, {color: colors.primary}]}>Featured</Text>
						</View>
					</View>
					
					{featuredProducts.length === 0 ? (
						<View style={[styles.emptyContainer, {backgroundColor: colors.card}]}>
							<Ionicons name='leaf-outline' size={48} color={colors.textMuted} />
							<Text style={[styles.emptyText, {color: colors.textSecondary}]}>No products found</Text>
							<Text style={[styles.emptySubtext, {color: colors.textMuted}]}>Try a different category or search</Text>
						</View>
					) : (
						<FlatList
							data={featuredProducts}
							numColumns={1}
							keyExtractor={(item) => item.id}
							contentContainerStyle={styles.productsGrid}
							renderItem={({ item, index }) => (
								<AnimatedProductCard index={index}>
									<Link
										href={{ pathname: '/product/[id]', params: { id: item.id } }}
										asChild
									>
										<TouchableOpacity
											style={[styles.modernProductCard, {
												backgroundColor: colorScheme === 'dark' ? colors.cardAlt : '#FFFFFF',
												borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#E2E8F0'
											}]}
											activeOpacity={0.7}
										>
											<View style={styles.modernProductImageContainer}>
												<Image
													source={{ uri: item.image }}
													style={styles.modernProductImage}
												/>
												
												{item.likes !== undefined && item.likes > 0 && (
													<View style={[styles.modernLikeBadge, {backgroundColor: colors.likeButton + 'E6'}]}>
														<Ionicons name="heart" size={12} color="#FFF" />
														<Text style={styles.likeCount}>{item.likes}</Text>
													</View>
												)}
												
												<View style={[styles.modernProductTypeBadge, {backgroundColor: colors.primaryDark + 'E6'}]}>
													<Text style={styles.modernProductTypeText}>
														{item.type}
													</Text>
												</View>
												
												{item.stock !== undefined && item.stock <= 5 && (
													<View style={[
														styles.modernStockBadge, 
														{
															backgroundColor: item.stock === 0 
																? colors.error + 'E6' 
																: colors.warning + 'E6'
														}
													]}>
														<Text style={styles.stockText}>
															{item.stock === 0 ? 'Out of stock' : `Only ${item.stock} left`}
														</Text>
													</View>
												)}
											</View>
											
											<View style={styles.modernProductContent}>
												<View style={styles.modernProductHeader}>
													<Text
														style={[styles.modernProductName, {color: colors.text}]}
														numberOfLines={1}
													>
														{item.name}
													</Text>
													
													<View style={styles.priceContainer}>
														<Text style={[styles.modernProductPrice, {color: colors.success}]}>
															৳{item.price.toFixed(2)}
														</Text>
														<Text style={[styles.modernProductUnit, {color: colors.textSecondary}]}>
															/{item.unit}
														</Text>
													</View>
												</View>
												
												<View style={styles.shopInfoContainer}>
													{item.shopId && (
														<View style={[styles.modernShopInfo, {
														backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'
													}]}>
															<Ionicons name="storefront-outline" size={16} color={colors.primary} />
															<Text style={[styles.modernProductShop, {color: colors.textSecondary}]} numberOfLines={1}>
																{item.shopName || "Farmer's Market"}
															</Text>
														</View>
													)}
													<TouchableOpacity style={[styles.modernAddToCartButton, {backgroundColor: colors.primary}]}>
														<Ionicons name="cart-outline" size={18} color="#FFFFFF" />
													</TouchableOpacity>
												</View>
											</View>
										</TouchableOpacity>
									</Link>
								</AnimatedProductCard>
							)}
							scrollEnabled={false}
						/>
					)}
				</View>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F1F5F9',
		paddingHorizontal: 0,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#F1F5F9',
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		fontWeight: '500',
	},
	// Header styles
	headerContainer: {
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		overflow: 'hidden',
		marginBottom: 15,
		elevation: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.12,
		shadowRadius: 8,
	},
	headerGradient: {
		paddingTop: Platform.OS === 'ios' ? 50 : 25,
		paddingBottom: 24,
	},
	headerContent: {
		paddingHorizontal: 20,
	},
	headerTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	welcomeText: {
		fontSize: 15,
		color: 'rgba(255, 255, 255, 0.85)',
		marginBottom: 4,
		fontWeight: '500',
	},
	userName: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	profileButton: {
		width: 42,
		height: 42,
		borderRadius: 21,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1.5,
		borderColor: 'rgba(255, 255, 255, 0.3)',
	},
	weatherCard: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.95)',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 16,
		alignSelf: 'flex-start',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	weatherIconContainer: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: 'rgba(46, 125, 50, 0.12)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	weatherTemp: {
		fontSize: 16,
		fontWeight: 'bold',
		marginLeft: 8,
		color: '#333',
	},
	weatherCity: {
		fontSize: 14,
		marginLeft: 6,
		color: '#666',
		borderLeftWidth: 1,
		borderLeftColor: '#ddd',
		paddingLeft: 6,
	},
	
	// Main content styles
	mainContent: {
		paddingHorizontal: 20,
		paddingTop: 10,
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#fff',
		borderRadius: 16,
		paddingVertical: 12,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: '#eaefea',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.08,
		shadowRadius: 2,
	},
	searchIconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: 'rgba(46, 125, 50, 0.1)',
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: 8,
		marginRight: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 16,
		color: '#333',
	},
	clearSearchButton: {
		padding: 8,
		marginRight: 8,
	},
	
	// Section styles
	sectionContainer: {
		marginBottom: 24,
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#333',
	},
	sectionSubtitle: {
		fontSize: 14,
		color: '#666',
		marginTop: 2,
	},
	sortIndicator: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#ffebee',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	sortText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#e91e63',
		marginLeft: 4,
	},
	viewToggle: {
		flexDirection: 'row',
		backgroundColor: 'rgba(0,0,0,0.05)',
		borderRadius: 8,
		padding: 3,
	},
	toggleButton: {
		padding: 6,
		borderRadius: 6,
		marginHorizontal: 2,
	},
	toggleActiveButton: {
		backgroundColor: '#2E7D32',
	},
	
	// Categories styles
	categoriesList: {
		paddingVertical: 8,
	},
	categoryCard: {
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 14,
		marginRight: 12,
		alignItems: 'center',
		minWidth: 110,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 4,
		elevation: 2,
		paddingBottom: 16,
	},
	selectedCategoryCard: {
		shadowOpacity: 0.1,
		elevation: 3,
	},
	categoryIcon: {
		width: 48,
		height: 48,
		borderRadius: 24,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 10,
	},
	categoryLabel: {
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	categorySelectedIndicator: {
		position: 'absolute',
		bottom: 6,
		width: 20,
		height: 3,
		borderRadius: 1.5,
		backgroundColor: '#fff',
	},
	
	// Products styles
	productsGrid: {
		paddingVertical: 16,
		paddingHorizontal: 0,
	},
	productsList: {
		paddingVertical: 8,
	},
	productCard: {
		flex: 1,
		margin: 8,
		borderRadius: 20,
		backgroundColor: '#FFFFFF',
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 5,
		borderWidth: 1,
	},
	productImageContainer: {
		position: 'relative',
		height: CARD_WIDTH * 0.9,
		overflow: 'hidden',
	},
	productImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	productTypeBadge: {
		position: 'absolute',
		top: 12,
		left: 12,
		backgroundColor: 'rgba(30, 41, 59, 0.85)',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 10,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 3,
	},
	productTypeText: {
		fontSize: 12,
		color: '#FFFFFF',
		fontWeight: '700',
		textTransform: 'capitalize',
	},
	likeBadge: {
		position: 'absolute',
		top: 12,
		right: 12,
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(220, 38, 38, 0.85)',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 10,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 2,
	},
	likeCount: {
		fontSize: 11,
		fontWeight: '600',
		color: '#FFFFFF',
		marginLeft: 3,
	},
	stockBadge: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		paddingVertical: 6,
		paddingHorizontal: 12,
		backgroundColor: 'rgba(245, 158, 11, 0.9)',
	},
	stockText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#FFFFFF',
		textAlign: 'center',
	},
	productContent: {
		padding: 16,
	},
	productHeader: {
		marginBottom: 10,
	},
	productName: {
		fontSize: 17,
		fontWeight: '700',
		flex: 1,
		lineHeight: 22,
	},
	priceContainer: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'flex-end',
	},
	productPrice: {
		fontSize: 20,
		fontWeight: '800',
	},
	productUnit: {
		fontSize: 14,
		marginLeft: 2,
		fontWeight: '500',
	},
	shopInfoContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 8,
	},
	shopInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 8,
	},
	productShop: {
		fontSize: 13,
		marginLeft: 6,
		fontWeight: '500',
		flex: 1,
	},
	addToCartButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: '#2E7D32',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 10,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 2,
	},
	
	// List view styles
	productListItem: {
		flexDirection: 'row',
		backgroundColor: '#fff',
		borderRadius: 16,
		marginBottom: 12,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
		elevation: 3,
	},
	productListImage: {
		width: 100,
		height: 100,
		resizeMode: 'cover',
	},
	productListContent: {
		flex: 1,
		padding: 12,
		position: 'relative',
	},
	productListHeader: {
		marginBottom: 6,
	},
	productListTags: {
		flexDirection: 'row',
		alignItems: 'center',
		marginVertical: 4,
	},
	productListTypeBadge: {
		backgroundColor: 'rgba(30, 41, 59, 0.85)',
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		marginRight: 8,
	},
	productListTypeText: {
		fontSize: 10,
		color: '#FFFFFF',
		fontWeight: '600',
		textTransform: 'capitalize',
	},
	productListLikes: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(239, 68, 68, 0.1)',
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 8,
	},
	productListLikesText: {
		fontSize: 11,
		fontWeight: '600',
		color: '#EF4444',
		marginLeft: 3,
	},
	productListBottom: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 4,
	},
	productListShopInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		marginLeft: 10,
	},
	productListShopText: {
		fontSize: 11,
		color: '#64748B',
		marginLeft: 4,
		fontWeight: '500',
	},
	productListStockBadge: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		paddingVertical: 4,
		paddingHorizontal: 12,
	},
	productListStockText: {
		fontSize: 11,
		fontWeight: '600',
		textAlign: 'center',
	},
	productListCartButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: '#2E7D32',
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 1,
	},
	
	// Empty state
	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		padding: 40,
		backgroundColor: '#fff',
		borderRadius: 16,
		margin: 20,
		borderWidth: 1,
		borderColor: '#eaefea',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 3,
		elevation: 2,
	},
	emptyText: {
		fontSize: 18,
		fontWeight: '600',
		marginTop: 12,
		color: '#333',
	},
	emptySubtext: {
		fontSize: 14,
		textAlign: 'center',
		marginTop: 8,
		color: '#777',
		lineHeight: 20,
	},
	
	// Modern Card Styles
	modernProductCard: {
		marginVertical: 16,
		borderRadius: 24,
		backgroundColor: '#FFFFFF',
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.1,
		shadowRadius: 16,
		elevation: 6,
		borderWidth: 1,
		borderColor: '#E2E8F0',
		marginHorizontal: 20,
	},
	modernProductImageContainer: {
		position: 'relative',
		height: 200,
		width: '100%',
		overflow: 'hidden',
	},
	modernProductImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	modernProductContent: {
		padding: 20,
		marginBottom: 16,
		
	},
	modernProductHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
		width: '100%',
	},
	modernProductName: {
		fontSize: 18,
		fontWeight: '700',
		flex: 1,
		marginRight: 8,
		fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter-Bold',
	},
	modernProductPrice: {
		fontSize: 20,
		fontWeight: '800',
		fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter-Bold',
	},
	modernProductUnit: {
		fontSize: 14,
		marginLeft: 2,
		fontWeight: '500',
		fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter-Medium',
	},
	modernLikeBadge: {
		position: 'absolute',
		top: 16,
		right: 16,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	modernProductTypeBadge: {
		position: 'absolute',
		top: 16,
		left: 16,
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	modernProductTypeText: {
		fontSize: 13,
		color: '#FFFFFF',
		fontWeight: '700',
		textTransform: 'capitalize',
		fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter-Bold',
	},
	modernStockBadge: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
	modernShopInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: '#F5F7FA',
	},
	modernProductShop: {
		fontSize: 14,
		marginLeft: 8,
		fontWeight: '600',
		flex: 1,
		fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter-SemiBold',
	},
	modernAddToCartButton: {
		width: 42,
		height: 42,
		borderRadius: 21,
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 4,
	},
});
