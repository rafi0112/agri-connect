import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	View,
	Text,
	Image,
	StyleSheet,
	ActivityIndicator,
	TouchableOpacity,
	FlatList,
	ScrollView,
	SafeAreaView,
	Dimensions,
	StatusBar,
} from 'react-native';
import {
	doc,
	getDoc,
	getFirestore,
	collection,
	query,
	where,
	getDocs,
} from 'firebase/firestore';
import { app } from '../../config/firebase';
import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartProvider';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import { getCurrentLocation, calculateDistance, formatDistance, isValidLocation, normalizeLocation } from '../../utils/location';
import { openNavigation } from '../../utils/navigation';

const { width, height } = Dimensions.get('window');

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

type Product = {
	id: string;
	name: string;
	price: number;
	image: string;
	shopId: string;
	unit: string;
	description?: string;
	type?: string;
};

type Shop = {
	id: string;
	name: string;
	farmerId: string;
	location: {
		latitude: number;
		longitude: number;
	} | string;
	image?: string;
	rating?: number;
	productsCount?: number;
};

function ProductDetailScreen() {
	const { id } = useLocalSearchParams();
	const router = useRouter();
	const [product, setProduct] = useState<Product | null>(null);
	const [shop, setShop] = useState<Shop | null>(null);
	const [loading, setLoading] = useState(true);
	const [addingToCart, setAddingToCart] = useState(false);
	const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
	const [distance, setDistance] = useState<number | null>(null);
	const [userLocation, setUserLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const { addToCart } = useCart();
	const db = getFirestore(app);

	// Get user location on component mount
	useEffect(() => {
		const initializeLocation = async () => {
			const location = await getCurrentLocation();
			if (location) {
				setUserLocation(location);
			}
		};
		initializeLocation();
	}, []);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const productRef = doc(db, 'products', id as string);
				const productSnap = await getDoc(productRef);

				if (!productSnap.exists()) {
					await Notifications.scheduleNotificationAsync({
						content: {
							title: 'Product Not Found',
							body: 'The requested product could not be found',
						},
						trigger: null,
					});
					return;
				}

				const productData = productSnap.data();
				const currentProduct: Product = {
					id: productSnap.id,
					name: productData.name || 'No Name',
					price: productData.price || 0,
					image: productData.image || 'https://via.placeholder.com/300',
					shopId: productData.shopId || '',
					unit: productData.unit || '',
					description: productData.description,
					type: productData.type,
				};
				setProduct(currentProduct);

				if (currentProduct.shopId) {
					const shopRef = doc(db, 'shops', currentProduct.shopId);
					const shopSnap = await getDoc(shopRef);

					if (shopSnap.exists()) {
						const shopData = shopSnap.data();
						const shopInfo: Shop = {
							id: shopSnap.id,
							name: shopData.name || 'No Shop Name',
							farmerId: shopData.farmerId || '',
							location: shopData.location || 'Location not specified',
							image: shopData.image,
							rating: shopData.rating || 0,
							productsCount: shopData.productsCount || 0,
						};
						setShop(shopInfo);

						// Calculate distance if both user location and shop location are available
						const isValidLocationData = isValidLocation(shopData.location);
						const normalizedLocation = normalizeLocation(shopData.location);
							
						if (userLocation && isValidLocationData && normalizedLocation) {
							const calculatedDistance = calculateDistance(
								userLocation.latitude,
								userLocation.longitude,
								normalizedLocation.latitude,
								normalizedLocation.longitude
							);
							setDistance(calculatedDistance);
						}
					}
				}
			} catch (error) {
				console.error('Error:', error);
				await Notifications.scheduleNotificationAsync({
					content: {
						title: 'Error',
						body: 'Failed to load product details',
					},
					trigger: null,
				});
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [id, userLocation]);

	useEffect(() => {
		const fetchSimilarProducts = async () => {
			if (!product) return;

			try {
				const similarProductsRef = collection(db, 'products');
				const similarProductsQuery = query(
					similarProductsRef,
					where('shopId', '==', product.shopId)
				);
				const querySnapshot = await getDocs(similarProductsQuery);

				const fetchedProducts: Product[] = querySnapshot.docs
					.filter((docSnap) => docSnap.id !== product.id)
					.map((docSnap) => {
						const data = docSnap.data();
						return {
							id: docSnap.id,
							name: data.name,
							price: data.price,
							image: data.image || 'https://via.placeholder.com/150',
							shopId: data.shopId,
							unit: data.unit,
						};
					});

				setSimilarProducts(fetchedProducts);
			} catch (error) {
				console.error('Error fetching similar products:', error);
			}
		};

		fetchSimilarProducts();
	}, [product]);

	const handleAddToCart = async () => {
		if (!product) return;
		
		console.log('Adding to cart:', product.name);
		console.log('Product data:', {
			id: product.id,
			name: product.name,
			price: product.price,
			image: product.image,
			unit: product.unit,
			shopId: product.shopId,
			shopName: shop?.name,
			farmerId: shop?.farmerId,
		});
		
		setAddingToCart(true);
		try {
			await addToCart({
				id: product.id,
				name: product.name,
				price: product.price,
				image: product.image,
				unit: product.unit,
				shopId: product.shopId,
				shopName: shop?.name,
				farmerId: shop?.farmerId,
			});
			
			Toast.show({
				type: 'success',
				text1: 'Added to Cart',
				text2: `${product.name} has been added to your cart`,
			});
			
			console.log('Successfully added to cart');
			router.push('/(tabs)/cart');
		} catch (error) {
			console.error('Error adding to cart:', error);
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'Failed to add to cart',
			});
		} finally {
			setAddingToCart(false);
		}
	};

	const handleGetDirections = () => {
		if (!shop) return;
		
		const normalizedLocation = normalizeLocation(shop.location);
		if (!normalizedLocation) {
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'Shop location not available',
			});
			return;
		}

		openNavigation({
			latitude: normalizedLocation.latitude,
			longitude: normalizedLocation.longitude,
			name: shop.name,
		});
	};

	const renderSimilarProduct = ({ item }: { item: Product }) => (
		<TouchableOpacity
			style={styles.carouselItem}
			onPress={() => router.push(`/product/${item.id}`)}
		>
			<Image source={{ uri: item.image }} style={styles.carouselImage} />
			<Text style={styles.carouselName} numberOfLines={2}>{item.name}</Text>
			<Text style={styles.carouselPrice}>৳{item.price.toFixed(2)}</Text>
		</TouchableOpacity>
	);

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#4CAF50' />
				<Text style={styles.loadingText}>Loading product...</Text>
			</View>
		);
	}

	if (!product) {
		return (
			<SafeAreaView style={styles.container}>
				<Text style={styles.errorText}>Product not found</Text>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
			
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color="#fff" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Product Details</Text>
				<View style={styles.headerRight} />
			</View>

			<ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
				{/* Product Image */}
				<View style={styles.imageContainer}>
					<Image source={{ uri: product.image }} style={styles.productImage} />
				</View>

				{/* Product Information */}
				<View style={styles.productContainer}>
					<View style={styles.productHeader}>
						<Text style={styles.productName}>{product.name}</Text>
						<View style={styles.priceRow}>
							<Text style={styles.price}>৳{product.price.toFixed(2)}</Text>
							<Text style={styles.unit}>per {product.unit}</Text>
						</View>
					</View>

					<Text style={styles.description}>
						{product.description || 'Fresh and quality product from local farmers.'}
					</Text>

					{/* Shop Information */}
					{shop && (
						<View style={styles.shopCard}>
							<View style={styles.shopHeader}>
								<View style={styles.shopImageContainer}>
									{shop.image ? (
										<Image source={{ uri: shop.image }} style={styles.shopImage} />
									) : (
										<View style={styles.shopImagePlaceholder}>
											<Ionicons name="storefront" size={24} color="#4CAF50" />
										</View>
									)}
								</View>
								<View style={styles.shopInfo}>
									<Text style={styles.shopName}>{shop.name}</Text>
									<Text style={styles.farmerInfo}>Farmer ID: {shop.farmerId}</Text>
									{shop.rating && shop.rating > 0 && (
										<View style={styles.ratingContainer}>
											<Ionicons name="star" size={14} color="#FFB300" />
											<Text style={styles.ratingText}>{shop.rating.toFixed(1)}</Text>
										</View>
									)}
								</View>
							</View>

							{/* Shop Details */}
							<View style={styles.shopDetails}>
								<View style={styles.shopDetailRow}>
									<Ionicons name="storefront-outline" size={16} color="#666" />
									<Text style={styles.shopDetailText}>
										{shop.productsCount || 0} products available
									</Text>
								</View>
								
								<View style={styles.shopDetailRow}>
									<Ionicons name="location-outline" size={16} color="#666" />
									<Text style={styles.shopDetailText}>
										{(() => {
											if (typeof shop.location === 'string') {
												return shop.location;
											}
											
											if (isValidLocation(shop.location)) {
												const normalized = normalizeLocation(shop.location);
												if (normalized) {
													return `${normalized.latitude.toFixed(4)}, ${normalized.longitude.toFixed(4)}`;
												}
												return 'Invalid coordinates';
											}
											
											return 'Location not available';
										})()}
									</Text>
								</View>

								{distance !== null && distance !== undefined && (
									<View style={styles.distanceRow}>
										<View style={styles.distanceInfo}>
											<Ionicons name="navigate" size={16} color="#4CAF50" />
											<Text style={styles.distanceText}>
												{formatDistance(distance)} away
											</Text>
										</View>
										<TouchableOpacity 
											style={styles.directionsButton}
											onPress={handleGetDirections}
										>
											<Ionicons name="navigate-outline" size={16} color="#2196F3" />
											<Text style={styles.directionsButtonText}>Directions</Text>
										</TouchableOpacity>
									</View>
								)}
							</View>
						</View>
					)}

					{/* Similar Products */}
					{similarProducts.length > 0 && (
						<View style={styles.similarSection}>
							<Text style={styles.sectionTitle}>You might also like</Text>
							<FlatList
								data={similarProducts}
								horizontal
								showsHorizontalScrollIndicator={false}
								renderItem={renderSimilarProduct}
								keyExtractor={(item) => item.id}
								contentContainerStyle={styles.similarList}
							/>
						</View>
					)}
				</View>
			</ScrollView>

			{/* Add to Cart Button */}
			<View style={styles.bottomContainer}>
				<TouchableOpacity
					style={[styles.addToCartButton, addingToCart && styles.addToCartButtonDisabled]}
					onPress={handleAddToCart}
					disabled={addingToCart}
				>
					{addingToCart ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<>
							<Ionicons name="cart" size={20} color="#fff" />
							<Text style={styles.addToCartText}>Add to Cart</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f8f9fa',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#fff',
	},
	loadingText: {
		fontSize: 16,
		color: '#666',
		marginTop: 10,
	},
	errorText: {
		fontSize: 18,
		color: '#ff3b30',
		textAlign: 'center',
		marginTop: 20,
	},
	imageContainer: {
		width: '100%',
		height: 300,
		overflow: 'hidden',
		borderTopLeftRadius: 12,
		borderTopRightRadius: 12,
	},
	productImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	productContainer: {
		padding: 16,
	},
	productHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
	},
	productName: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#333',
		flex: 1,
	},
	priceRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
	},
	price: {
		fontSize: 20,
		fontWeight: '700',
		color: '#2e86de',
	},
	unit: {
		fontSize: 16,
		color: '#666',
		marginLeft: 4,
	},
	description: {
		fontSize: 16,
		lineHeight: 24,
		color: '#555',
		marginTop: 12,
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 12,
		color: '#4CAF50',
	},
	shopCard: {
		backgroundColor: '#f8f9fa',
		borderRadius: 12,
		padding: 16,
		marginBottom: 24,
		elevation: 2,
	},
	shopHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
	},
	shopImageContainer: {
		width: 60,
		height: 60,
		borderRadius: 30,
		overflow: 'hidden',
		marginRight: 12,
	},
	shopImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	shopInfo: {
		flex: 1,
	},
	shopName: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333',
	},
	farmerInfo: {
		fontSize: 14,
		color: '#666',
		marginTop: 4,
	},
	ratingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
	},
	ratingText: {
		marginLeft: 6,
		color: '#666',
	},
	shopDetails: {
		marginTop: 8,
	},
	shopDetailRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
	},
	shopDetailText: {
		fontSize: 14,
		color: '#555',
		marginLeft: 8,
	},
	distanceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 8,
		marginBottom: 4,
		justifyContent: 'space-between',
	},
	distanceInfo: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	distanceText: {
		fontSize: 14,
		color: '#4CAF50',
		marginLeft: 4,
		fontWeight: '600',
	},
	directionsButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 4,
		backgroundColor: '#e3f2fd',
		borderRadius: 12,
	},
	directionsButtonText: {
		fontSize: 12,
		color: '#2196F3',
		marginLeft: 4,
		fontWeight: '500',
	},
	bottomContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: '#fff',
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 34,
		borderTopWidth: 1,
		borderTopColor: '#e9ecef',
	},
	addToCartButton: {
		backgroundColor: '#4CAF50',
		borderRadius: 16,
		paddingVertical: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#4CAF50',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 4,
	},
	buttonContent: {
		alignItems: 'center',
	},
	iconWithText: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	addToCartText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
		marginLeft: 8,
	},
	similarSection: {
		marginTop: 16,
	},
	carouselItem: {
		width: 160,
		backgroundColor: '#fff',
		borderRadius: 8,
		padding: 12,
		marginRight: 12,
		alignItems: 'center',
		elevation: 2,
	},
	carouselImage: {
		width: 120,
		height: 120,
		borderRadius: 8,
		marginBottom: 8,
	},
	carouselName: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#333',
		textAlign: 'center',
	},
	carouselPrice: {
		fontSize: 14,
		color: '#2e86de',
	},
	// New modern styles
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#4CAF50',
		paddingHorizontal: 16,
		paddingVertical: 12,
		paddingTop: 44,
		elevation: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	backButton: {
		padding: 8,
		borderRadius: 20,
		backgroundColor: 'rgba(255,255,255,0.1)',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#fff',
	},
	headerRight: {
		width: 40,
	},
	scrollView: {
		flex: 1,
	},
	shopImagePlaceholder: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#e8f5e8',
		justifyContent: 'center',
		alignItems: 'center',
	},
	similarList: {
		paddingRight: 20,
	},
	addToCartButtonDisabled: {
		backgroundColor: '#a5d6a7',
	},
});

export default ProductDetailScreen;
