import { useState, useEffect } from 'react';
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
} from '@expo/vector-icons';

type Product = {
	id: string;
	name: string;
	price: number;
	image: string;
	shopId: string;
	unit: string;
	type: string;
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
};

export default function HomeScreen() {
	const { user } = useAuth();
	const [products, setProducts] = useState<Product[]>([]);
	const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [weatherLoading, setWeatherLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<string>('all');
	const [categories, setCategories] = useState<Category[]>([]);
	const db = getFirestore(app);

	const OPENWEATHER_API_KEY = 'd734f951c52155a9771143721b7eb908';

	// Updated the getCategoryIcon function to assign random icons for each category
	const getCategoryIcon = (categoryName: string) => {
		const icons = [
			<MaterialCommunityIcons name='barley' size={24} color='#039BE5' />,
			<MaterialCommunityIcons name='barley' size={24} color='#6D4C41' />,
			<MaterialCommunityIcons name='barley' size={24} color='#FBC02D' />,
			<MaterialCommunityIcons name='barley' size={24} color='#8E24AA' />,
			<MaterialCommunityIcons name='barley' size={24} color='#FF5722' />,
			<MaterialCommunityIcons name='barley' size={24} color='#388E3C' />,
			<MaterialCommunityIcons name='barley' size={24} color='#FF9800' />,
			<MaterialCommunityIcons name='barley' size={24} color='#1976D2' />,
			<MaterialCommunityIcons name='barley' size={24} color='#7B1FA2' />,
			<MaterialCommunityIcons name='barley' size={24} color='#FFC107' />,
		];

		// Generate a random index to pick an icon
		const randomIndex = Math.floor(Math.random() * icons.length);
		return icons[randomIndex];
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
					});
					uniqueCategories.add(productType);
				});

				// Create category objects with icons
				const categoryList: Category[] = Array.from(uniqueCategories).map(
					(cat) => ({
						name: cat,
						icon: getCategoryIcon(cat),
					})
				);

				setProducts(productsData);
				setFilteredProducts(productsData);
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

		setFilteredProducts(filtered);
	}, [searchQuery, products, selectedCategory]);

	const mapWeatherIcon = (iconCode: string) => {
		const iconMap: Record<string, string> = {
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
			'50d': 'cloudy',
			'50n': 'cloudy',
		};
		return iconMap[iconCode] || 'partly-sunny';
	};

	const handleCategoryPress = (category: string) => {
		setSelectedCategory(category);
	};

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#4CAF50' />
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
						<Text style={styles.welcomeText}>
							Hello,{' '}
							<Text style={styles.userName}>{user?.name || 'Guest'}</Text>
						</Text>

						{weather && (
							<View style={styles.weatherBox}>
								<Ionicons
									name={
										weather.icon
											? (`${weather.icon}-outline` as const)
											: 'cloud-outline'
									}
									size={18}
									color='#4CAF50'
									style={{ marginRight: 6 }}
								/>
								<Text style={styles.weatherText}>
									{weather.temp}°C • {weather.description}
								</Text>
							</View>
						)}
					</View>

					<Link href='/profile' asChild>
						<TouchableOpacity style={styles.profileIconContainer}>
							<Ionicons
								name='person-circle-outline'
								size={60}
								color='#4CAF50'
							/>
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
						placeholderTextColor='#9ca3af'
						style={styles.searchInput}
						value={searchQuery}
						onChangeText={setSearchQuery}
					/>
				</View>
			</View>

			{/* Categories Horizontal Scroll */}
			<View style={styles.sectionContainer}>
				<Text style={styles.sectionTitle}>Categories</Text>
				<FlatList
					data={categories}
					numColumns={4}
					keyExtractor={(item) => item.name}
					renderItem={({ item }) => (
						<TouchableOpacity
							style={[
								styles.categoryGridItem,
								selectedCategory === item.name &&
									styles.selectedCategoryGridItem,
							]}
							onPress={() => handleCategoryPress(item.name)}
						>
							<View
								style={[
									styles.iconWrapper,
									selectedCategory === item.name && styles.selectedIconWrapper,
								]}
							>
								{item.icon}
							</View>
							<Text
								style={[
									styles.categoryLabel,
									selectedCategory === item.name &&
										styles.selectedCategoryLabel,
								]}
							>
								{item.name.charAt(0).toUpperCase() + item.name.slice(1)}
							</Text>
						</TouchableOpacity>
					)}
					scrollEnabled={false}
					contentContainerStyle={styles.categoriesGrid}
				/>
			</View>

			{/* Featured Products Section */}
			<View style={styles.sectionContainer}>
				<Text style={styles.sectionTitle}>Featured Products</Text>
				{featuredProducts.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Ionicons name='sad-outline' size={48} color='#ccc' />
						<Text style={styles.emptyText}>No products found</Text>
					</View>
				) : (
					<FlatList
						data={featuredProducts}
						numColumns={2}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<Link
								href={{ pathname: '/product/[id]', params: { id: item.id } }}
								asChild
							>
								<TouchableOpacity style={styles.productCard}>
									{item.type === 'new' && (
										<View style={styles.newBadge}>
											<Text style={styles.newBadgeText}>NEW</Text>
										</View>
									)}
									<Image
										source={{ uri: item.image }}
										style={styles.productImage}
										defaultSource={{ uri: 'https://via.placeholder.com/150' }}
									/>
									<View style={styles.productInfo}>
										<Text style={styles.productName} numberOfLines={1}>
											{item.name}
										</Text>
										<View style={styles.priceContainer}>
											<Text style={styles.productPrice}>
												৳{item.price.toFixed(2)}
											</Text>
											<Text style={styles.productUnit}>/{item.unit}</Text>
										</View>
									</View>
								</TouchableOpacity>
							</Link>
						)}
						contentContainerStyle={styles.productsContainer}
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
		backgroundColor: '#f6fcf6',
		paddingHorizontal: 16,
	},

	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},

	topSection: {
		marginBottom: 20,
		marginTop: 20,
	},

	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#ffffff',
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		marginBottom: 20,
	},

	headerLeft: {
		flex: 1,
	},

	welcomeText: {
		fontSize: 16,
		color: '#111827',
	},

	userName: {
		fontWeight: '600',
		color: '#10b981',
	},

	weatherBox: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#f0fdf4',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		marginTop: 6,
	},

	weatherText: {
		fontSize: 13,
		color: '#065f46',
	},

	profileIconContainer: {
		paddingLeft: 12,
	},

	searchSection: {
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#f1f5f9', // soft gray-blue
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		paddingHorizontal: 14,
		paddingVertical: 2,
		marginBottom: 20,
	},

	searchIcon: {
		marginRight: 8,
	},

	searchInput: {
		flex: 1,
		fontSize: 16,
		color: '#111827',
	},

	sectionContainer: {
		marginBottom: 24,
	},

	sectionTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#333',
		marginBottom: 12,
	},

	categoriesScrollContent: {
		paddingVertical: 4,
	},

	categoryButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingVertical: 10,
		backgroundColor: '#fff',
		borderRadius: 12,
		marginRight: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 3,
		elevation: 1,
	},

	selectedCategoryButton: {
		backgroundColor: '#4CAF50',
	},

	categoryIconContainer: {
		marginRight: 8,
	},

	categoryText: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#444',
	},

	selectedCategoryText: {
		color: '#fff',
		fontWeight: '600',
	},

	productsContainer: {
		marginBottom: 80,
	},

	productCard: {
		flex: 1,
		margin: 8,
		backgroundColor: '#ffffff',
		borderRadius: 16,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: '#e5e7eb',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},



	newBadgeText: {
		color: '#fff',
		fontSize: 10,
		fontWeight: 'bold',
	},

	productImage: {
		width: '100%',
		height: 140,
		resizeMode: 'cover',
		backgroundColor: '#f3f4f6',
	},

	productInfo: {
		padding: 12,
	},

	productName: {
		fontSize: 15,
		fontWeight: '500',
		color: '#111827',
		marginBottom: 6,
	},

	priceContainer: {
		flexDirection: 'row',
		alignItems: 'baseline',
	},

	productPrice: {
		fontSize: 16,
		fontWeight: '700',
		color: '#10b981',
	},
	
	productUnit: {
		fontSize: 13,
		color: '#6b7280',
		marginLeft: 4,
	},
	
	newBadge: {
		position: 'absolute',
		top: 10,
		left: 10,
		backgroundColor: '#10b981',
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
		zIndex: 1,
	},
	

	emptyContainer: {
		alignItems: 'center',
		padding: 32,
	},

	emptyText: {
		fontSize: 16,
		color: '#888',
		marginTop: 8,
	},
	categoriesGrid: {
		alignItems: 'center',
	},

	categoryGridItem: {
		width: '22%',
		margin: '2%',
		backgroundColor: '#fff',
		borderRadius: 12,
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 6,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 3,
		elevation: 2,
	},

	selectedCategoryGridItem: {
		backgroundColor: '#4CAF50',
	},

	iconWrapper: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#e0f2f1',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 8,
	},

	selectedIconWrapper: {
		backgroundColor: '#a5d6a7',
	},

	categoryLabel: {
		fontSize: 12,
		textAlign: 'center',
		color: '#444',
	},

	selectedCategoryLabel: {
		color: '#fff',
		fontWeight: '600',
	},
});
