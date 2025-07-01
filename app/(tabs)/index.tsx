import { useState, useEffect, useCallback } from 'react';
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
const CARD_WIDTH = width * 0.42;
const CARD_HEIGHT = CARD_WIDTH * 1.35;

type Product = {
	id: string;
	name: string;
	price: number;
	image: string;
	shopId: string;
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
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const db = getFirestore(app);
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];

	const OPENWEATHER_API_KEY = 'd734f951c52155a9771143721b7eb908';

	// Updated the getCategoryIcon function to assign random icons for each category
	const getCategoryIcon = (categoryName: string): { icon: JSX.Element, color: string } => {
		const iconOptions = [
			{ icon: <MaterialCommunityIcons name='barley' size={24} color='#FFFFFF' />, color: '#2E7D32' },
			{ icon: <MaterialCommunityIcons name='leaf' size={24} color='#FFFFFF' />, color: '#388E3C' },
			{ icon: <MaterialCommunityIcons name='food-apple' size={24} color='#FFFFFF' />, color: '#43A047' },
			{ icon: <MaterialCommunityIcons name='carrot' size={24} color='#FFFFFF' />, color: '#4CAF50' },
			{ icon: <MaterialCommunityIcons name='fruit-watermelon' size={24} color='#FFFFFF' />, color: '#66BB6A' },
			{ icon: <MaterialCommunityIcons name='fruit-cherries' size={24} color='#FFFFFF' />, color: '#81C784' },
			{ icon: <MaterialCommunityIcons name='corn' size={24} color='#FFFFFF' />, color: '#8BC34A' },
			{ icon: <Ionicons name='nutrition' size={24} color='#FFFFFF' />, color: '#9CCC65' },
			{ icon: <MaterialCommunityIcons name='silo' size={24} color='#FFFFFF' />, color: '#CDDC39' },
			{ icon: <FontAwesome name='leaf' size={24} color='#FFFFFF' />, color: '#8D6E63' },
		];

		// Special case for 'all' category
		if (categoryName === 'all') {
			return { 
				icon: <MaterialIcons name='category' size={24} color='#FFFFFF' />,
				color: colors.primary
			};
		}

		// Generate a consistent index based on the category name
		const nameSum = categoryName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
		const index = nameSum % iconOptions.length;
		
		return iconOptions[index];
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

				setProducts(sortedProducts);
				setFilteredProducts(sortedProducts);
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

			setProducts(sortedProducts);
			setFilteredProducts(sortedProducts);
			setCategories(categoryList);
		} catch (error) {
			console.error('Error refreshing products:', error);
		} finally {
			setRefreshing(false);
		}
	}, [db]);

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#2d5a3d' />
			</View>
		);
	}

	// Limit the number of featured products to 6
	const featuredProducts = filteredProducts.slice(0, 6);

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			{/* Combined Search and Header Section */}
			<View style={styles.topSection}>
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<View style={styles.greetingContainer}>
							<Text style={styles.welcomeText}>Hello there,</Text>
							<View style={styles.userNameContainer}>
								<Text style={styles.userName}>
									{user?.name || 'Guest'}
								</Text>
								<View style={styles.userNameGlow} />
							</View>
						</View>

						{weather && (
							<View style={styles.weatherContainer}>
								<View style={styles.weatherIconContainer}>
									<Ionicons
										name={
											weather.icon
												? (`${weather.icon}-outline` as const)
												: 'cloud-outline'
										}
										size={22}
										color='#34d399'
									/>
									<View style={styles.weatherIconGlow} />
								</View>
								<View style={styles.weatherInfo}>
									<Text style={styles.weatherTemp}>{weather.temp}°C</Text>
									<Text style={styles.weatherDesc}>{weather.description}</Text>
								</View>
								<View style={styles.weatherPulse} />
							</View>
						)}
					</View>

					<Link href='/profile' asChild>
						<TouchableOpacity style={styles.profileIconContainer}>
							<View style={styles.profileIconWrapper}>
								<Ionicons
									name='person-circle-outline'
									size={48}
									color='#ffffff'
								/>
								<View style={styles.profileGlow} />
							</View>
						</TouchableOpacity>
					</Link>
				</View>

				{/* Search Bar */}
				<View style={styles.searchSection}>
					<Ionicons
						name='search'
						size={20}
						color='#6b7280'
						style={styles.searchIcon}
					/>
					<TextInput
						placeholder='Search products...'
						placeholderTextColor='#6b8e70'
						style={styles.searchInput}
						value={searchQuery}
						onChangeText={setSearchQuery}
					/>
				</View>
			</View>				{/* --- MODERN CATEGORY SECTION --- */}
			<View style={styles.sectionContainer}>
				<View style={styles.sectionTitleRow}>
					<Text style={styles.sectionTitle}>Categories</Text>
					<View style={styles.sortIndicator}>
						<Ionicons name="heart" size={14} color="#e91e63" />
						<Text style={styles.sortText}>Top liked first</Text>
					</View>
				</View>
				<FlatList
					data={categories}
					horizontal
					showsHorizontalScrollIndicator={false}
					keyExtractor={(item) => item.name}
					contentContainerStyle={styles.categoriesHorizontalList}
					renderItem={({ item }) => (
						<TouchableOpacity
							style={[
								styles.categoryCardModern,
								selectedCategory === item.name &&
									styles.selectedCategoryCardModern,
							]}
							onPress={() => handleCategoryPress(item.name)}
							activeOpacity={0.8}
						>
							<View style={styles.categoryIconModern}>{item.icon}</View>
							<Text
								style={[
									styles.categoryCardLabelModern,
									selectedCategory === item.name &&
										styles.selectedCategoryCardLabelModern,
								]}
							>
								{item.name.charAt(0).toUpperCase() + item.name.slice(1)}
							</Text>
						</TouchableOpacity>
					)}
				/>
			</View>

			{/* --- MODERN FEATURED SECTION WITH GRID/LIST TOGGLE --- */}
			<View style={styles.sectionContainer}>
				<View style={styles.sectionTitleRow}>
					<View style={styles.titleWithSubtitle}>
						<Text style={styles.sectionTitle}>Featured Products</Text>
						<Text style={styles.sectionSubtitle}>Sorted by popularity</Text>
					</View>
					<View style={styles.toggleRow}>
						<TouchableOpacity
							onPress={() => setViewMode('grid')}
							style={[
								styles.toggleBtn,
								viewMode === 'grid' && styles.toggleBtnActive,
							]}
						>
							<Ionicons
								name='grid'
								size={18}
								color={viewMode === 'grid' ? '#fff' : '#fff'}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() => setViewMode('list')}
							style={[
								styles.toggleBtn,
								viewMode === 'list' && styles.toggleBtnActive,
							]}
						>
							<Ionicons
								name='list'
								size={18}
								color={viewMode === 'list' ? '#fff' : '#fff'}
							/>
						</TouchableOpacity>
					</View>
				</View>
				{featuredProducts.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Ionicons name='sad-outline' size={48} color='#64748b' />
						<Text style={styles.emptyText}>No products found</Text>
					</View>
				) : viewMode === 'grid' ? (
					<FlatList
						data={featuredProducts}
						numColumns={2}
						key={'grid'}
						keyExtractor={(item) => item.id}
						contentContainerStyle={styles.featuredGrid}
						renderItem={({ item }) => (
							<Link
								href={{ pathname: '/product/[id]', params: { id: item.id } }}
								asChild
							>
								<TouchableOpacity
									style={styles.featuredCardModern}
									activeOpacity={0.85}
								>
									<Image
										source={{ uri: item.image }}
										style={styles.featuredImageModern}
									/>
									<View style={styles.featuredInfoModern}>
										<Text
											style={styles.featuredNameModern}
											numberOfLines={1}
										>
											{item.name}
										</Text>
										<View style={styles.featuredMetaRow}>
											<View style={styles.featuredPriceRowModern}>
												<Text style={styles.featuredPriceModern}>
													৳{item.price.toFixed(2)}
												</Text>
												<Text style={styles.featuredUnitModern}>
													/{item.unit}
												</Text>
											</View>
											{item.likes !== undefined && item.likes > 0 && (
												<View style={styles.likesContainer}>
													<Ionicons name="heart" size={12} color="#e91e63" />
													<Text style={styles.likesCount}>{item.likes}</Text>
												</View>
											)}
										</View>
									</View>
								</TouchableOpacity>
							</Link>
						)}
						scrollEnabled={false}
					/>
				) : (
					<FlatList
						data={featuredProducts}
						key={'list'}
						keyExtractor={(item) => item.id}
						contentContainerStyle={styles.featuredList}
						renderItem={({ item }) => (
							<Link
								href={{ pathname: '/product/[id]', params: { id: item.id } }}
								asChild
							>
								<TouchableOpacity
									style={styles.featuredListItemModern}
									activeOpacity={0.85}
								>
									<Image
										source={{ uri: item.image }}
										style={styles.featuredListImageModern}
									/>
									<View style={styles.featuredListInfoModern}>
										<Text
											style={styles.featuredNameModern}
											numberOfLines={1}
										>
											{item.name}
										</Text>
										<View style={styles.featuredMetaRow}>
											<View style={styles.featuredPriceRowModern}>
												<Text style={styles.featuredPriceModern}>
													৳{item.price.toFixed(2)}
												</Text>
												<Text style={styles.featuredUnitModern}>
													/{item.unit}
												</Text>
											</View>
											{item.likes !== undefined && item.likes > 0 && (
												<View style={styles.likesContainer}>
													<Ionicons name="heart" size={12} color="#e91e63" />
													<Text style={styles.likesCount}>{item.likes}</Text>
												</View>
											)}
										</View>
									</View>
								</TouchableOpacity>
							</Link>
						)}
						scrollEnabled={false}
					/>
				)}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f0f7f0',
		paddingHorizontal: 16,
	},

	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#f0f7f0',
	},

	topSection: {
		marginBottom: 24,
		marginTop: 20,
	},

	// Enhanced header with darkish green theme and crazy effects
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#1a3d2e',
		padding: 24,
		borderRadius: 25,
		marginBottom: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 20,
		elevation: 15,
		borderWidth: 2,
		borderColor: '#34d399',
		position: 'relative',
		overflow: 'hidden',
	},

	headerLeft: {
		flex: 1,
	},

	greetingContainer: {
		marginBottom: 12,
	},

	welcomeText: {
		fontSize: 16,
		color: '#86efac',
		fontWeight: '600',
		marginBottom: 4,
		textShadowColor: 'rgba(52, 211, 153, 0.5)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},

	userNameContainer: {
		position: 'relative',
		alignSelf: 'flex-start',
	},

	userName: {
		fontSize: 24,
		fontWeight: '900',
		color: '#ffffff',
		letterSpacing: 1,
		textTransform: 'uppercase',
		textShadowColor: 'rgba(52, 211, 153, 0.8)',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 8,
	},

	userNameGlow: {
		position: 'absolute',
		top: -2,
		left: -2,
		right: -2,
		bottom: -2,
		backgroundColor: 'rgba(52, 211, 153, 0.2)',
		borderRadius: 8,
		zIndex: -1,
	},

	// Crazy weather container with animations and effects
	weatherContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(16, 185, 129, 0.2)',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 20,
		marginTop: 8,
		borderWidth: 1,
		borderColor: 'rgba(52, 211, 153, 0.5)',
		position: 'relative',
		overflow: 'hidden',
	},

	weatherIconContainer: {
		position: 'relative',
		marginRight: 12,
		backgroundColor: 'rgba(52, 211, 153, 0.3)',
		borderRadius: 20,
		padding: 8,
	},

	weatherIconGlow: {
		position: 'absolute',
		top: -2,
		left: -2,
		right: -2,
		bottom: -2,
		backgroundColor: 'rgba(52, 211, 153, 0.4)',
		borderRadius: 22,
		zIndex: -1,
	},

	weatherInfo: {
		flex: 1,
	},

	weatherTemp: {
		fontSize: 18,
		color: '#ffffff',
		fontWeight: '800',
		textShadowColor: 'rgba(52, 211, 153, 0.7)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 4,
	},

	weatherDesc: {
		fontSize: 12,
		color: '#bbf7d0',
		fontWeight: '600',
		textTransform: 'capitalize',
		marginTop: 2,
	},

	weatherPulse: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(52, 211, 153, 0.1)',
		borderRadius: 20,
	},

	profileIconContainer: {
		paddingLeft: 16,
	},

	profileIconWrapper: {
		position: 'relative',
		backgroundColor: 'rgba(52, 211, 153, 0.2)',
		borderRadius: 40,
		padding: 12,
		borderWidth: 2,
		borderColor: 'rgba(52, 211, 153, 0.6)',
	},

	profileGlow: {
		position: 'absolute',
		top: -4,
		left: -4,
		right: -4,
		bottom: -4,
		backgroundColor: 'rgba(52, 211, 153, 0.3)',
		borderRadius: 44,
		zIndex: -1,
	},

	// Enhanced search section
	searchSection: {
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#ffffff',
		borderRadius: 15,
		borderWidth: 1,
		borderColor: '#e8f5e8',
		paddingHorizontal: 16,
		paddingVertical: 14,
		marginBottom: 20,
		shadowColor: '#2d5a3d',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 6,
		elevation: 4,
	},

	searchIcon: {
		marginRight: 12,
		color: '#4a6b4f',
	},

	searchInput: {
		flex: 1,
		fontSize: 16,
		color: '#2d5a3d',
		fontWeight: '500',
	},

	sectionContainer: {
		marginBottom: 28,
	},

	// Crazy modern section title with glow effects
	sectionTitleContainer: {
		position: 'relative',
		marginBottom: 20,
		alignSelf: 'flex-start',
	},

	sectionTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#333',
	},

	sectionSubtitle: {
		fontSize: 12,
		fontWeight: '500',
		color: '#4a6b4f',
	},

	titleWithSubtitle: {
		flex: 1,
	},

	sectionTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 10,
	},

	toggleRow: {
		flexDirection: 'row',
		gap: 8,
	},

	toggleBtn: {
		backgroundColor: '#14532d', // dark green
		borderRadius: 8,
		padding: 6,
		marginLeft: 6,
	},

	toggleBtnActive: {
		backgroundColor: '#15803d', // slightly lighter dark green
	},

	sortIndicator: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#ffebee',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#fecdd3',
	},

	sortText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#e91e63',
		marginLeft: 4,
	},

	// Enhanced categories main container with background effects
	categoriesMainContainer: {
		position: 'relative',
		backgroundColor: 'rgba(255, 255, 255, 0.8)',
		borderRadius: 24,
		padding: 16,
		borderWidth: 2,
		borderColor: 'rgba(52, 211, 153, 0.2)',
		shadowColor: '#2d5a3d',
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8,
		overflow: 'hidden',
	},

	categoriesHorizontalList: {
		paddingVertical: 4,
		paddingLeft: 2,
	},

	// Crazy modern category grid items
	categoryCardModern: {
		backgroundColor: 'rgba(236, 253, 245, 0.95)', // very light green
		borderRadius: 16,
		alignItems: 'center',
		marginRight: 14,
		paddingVertical: 14,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: '#bbf7d0', // green border
		shadowColor: '#22c55e',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 6,
		elevation: 2,
		minWidth: 90,
		minHeight: 90,
		position: 'relative',
	},

	selectedCategoryCardModern: {
		backgroundColor: '#22c55e', // green
		borderColor: '#15803d', // dark green
		shadowColor: '#22c55e',
		shadowOpacity: 0.18,
	},

	categoryIconModern: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: '#bbf7d0', // greenish
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 8,
		borderWidth: 1,
		borderColor: '#4ade80', // green border
	},

	categoryCardLabelModern: {
		fontSize: 13,
		color: '#15803d', // dark green
		fontWeight: '600',
		textAlign: 'center',
	},

	selectedCategoryCardLabelModern: {
		color: '#fff',
		fontWeight: '700',
	},

	// Featured Products Section
	featuredGrid: {
		paddingVertical: 8,
		paddingLeft: 2,
	},

	// Enhanced featured cards
	featuredCardModern: {
		backgroundColor: '#f6fcf6', // light green
		borderRadius: 18,
		margin: 8,
		flex: 1,
		shadowColor: '#22c55e', // green shadow
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.10,
		shadowRadius: 8,
		elevation: 4,
		overflow: 'hidden',
		position: 'relative',
	},

	featuredImageModern: {
		width: '100%',
		height: 110,
		borderTopLeftRadius: 18,
		borderTopRightRadius: 18,
		resizeMode: 'cover',
		backgroundColor: '#bbf7d0', // greenish
	},

	featuredInfoModern: {
		padding: 12,
	},

	featuredNameModern: {
		fontSize: 15,
		fontWeight: '700',
		color: '#14532d', // dark green
		marginBottom: 6,
	},

	featuredMetaRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},

	featuredPriceRowModern: {
		flexDirection: 'row',
		alignItems: 'baseline',
	},

	featuredPriceModern: {
		fontSize: 16,
		fontWeight: '700',
		color: '#15803d', // dark green
	},

	featuredUnitModern: {
		fontSize: 13,
		color: '#15803d', // green
		marginLeft: 4,
	},

	likesContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#ffebee',
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 8,
	},

	likesCount: {
		fontSize: 12,
		fontWeight: '600',
		color: '#e91e63',
		marginLeft: 2,
	},

	featuredList: {
		paddingVertical: 8,
		paddingLeft: 2,
	},

	featuredListItemModern: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#f6fcf6', // light green
		borderRadius: 16,
		marginBottom: 14,
		marginHorizontal: 4,
		padding: 8,
		shadowColor: '#22c55e', // green shadow
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 6,
		elevation: 2,
	},
	featuredListImageModern: {
		width: 70,
		height: 70,
		borderRadius: 12,
		marginRight: 14,
		backgroundColor: '#bbf7d0', // greenish
	},
	featuredListInfoModern: {
		flex: 1,
		justifyContent: 'center',
	},

	// Enhanced new badge
	newBadge: {
		position: 'absolute',
		top: 12,
		left: 12,
		backgroundColor: '#14532d', // dark green
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 8,
		zIndex: 1,
		shadowColor: '#14532d', // dark green
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},

	emptyContainer: {
		alignItems: 'center',
		padding: 40,
		backgroundColor: '#ffffff',
		borderRadius: 18,
		borderWidth: 1,
		borderColor: '#e8f5e8',
	},

	emptyText: {
		fontSize: 16,
		color: '#4a6b4f',
		marginTop: 12,
		fontWeight: '500',
	},
});
