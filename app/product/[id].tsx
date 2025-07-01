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
	useColorScheme,
} from 'react-native';
import {
	doc,
	getDoc,
	getFirestore,
	collection,
	query,
	where,
	getDocs,
	updateDoc,
	increment,
	setDoc,
	deleteDoc,
} from 'firebase/firestore';
import { app } from '../../config/firebase';
import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import { getCurrentLocation, calculateDistance, formatDistance, isValidLocation, normalizeLocation } from '../../utils/location';
import { openNavigation } from '../../utils/navigation';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

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
	stock?: number;
	farmerId?: string;
	likes?: number;
	isLikedByUser?: boolean;
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
	stock?: number;
	likes?: number;
};

function ProductDetailScreen() {
	const { id } = useLocalSearchParams();
	const router = useRouter();
	const [product, setProduct] = useState<Product | null>(null);
	const [shop, setShop] = useState<Shop | null>(null);
	const [loading, setLoading] = useState(true);
	const [addingToCart, setAddingToCart] = useState(false);
	const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
	const [shopProducts, setShopProducts] = useState<Product[]>([]);
	const [totalStock, setTotalStock] = useState(0);
	const [isOutOfStock, setIsOutOfStock] = useState(false);
	const [distance, setDistance] = useState<number | null>(null);
	const [userLocation, setUserLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [isLiked, setIsLiked] = useState(false);
	const [likeCount, setLikeCount] = useState(0);
	const [productLikes, setProductLikes] = useState(0);
	const [isProductLiked, setIsProductLiked] = useState(false);
	const { addToCart } = useCart();
	const db = getFirestore(app);
	const {user} = useAuth();
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];

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
					stock: productData.stock || 0,
					farmerId: productData.farmerId || '',
					likes: productData.likes || 0,
				};
				
				// Set product likes count
				setProductLikes(currentProduct.likes || 0);
				
				// Check if product is liked by the current user
				if (user && user.id) {
					const userLikesRef = doc(db, 'users', user.id, 'likedProducts', currentProduct.id);
					const userLikesSnap = await getDoc(userLikesRef);
					setIsProductLiked(userLikesSnap.exists());
				}
				
				// Check if product is out of stock (less than 5 units)
				setIsOutOfStock(currentProduct.stock !== undefined && currentProduct.stock < 5);
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
							stock: shopData.stock || 0,
						};
						setShop(shopInfo);
						
						// Fetch all products with the same farmerId to get total stock
						const productsRef = collection(db, 'products');
						const productsQuery = query(productsRef, where('farmerId', '==', shopData.farmerId));
						const productsSnap = await getDocs(productsQuery);
						
						let productsStock: Product[] = [];
						let totalStockCount = 0;
						
						productsSnap.forEach((doc) => {
							const data = doc.data();
							const stock = data.stock || 0;
							totalStockCount += stock;
							
							productsStock.push({
								id: doc.id,
								name: data.name || 'No Name',
								price: data.price || 0,
								image: data.image || 'https://via.placeholder.com/150',
								shopId: data.shopId || '',
								unit: data.unit || '',
								stock: stock,
								type: data.type || '',
								farmerId: data.farmerId || '',
							});
						});
						
						setShopProducts(productsStock);
						setTotalStock(totalStockCount);
						
						// Initialize likes count from Firestore, defaulting to 0 if not present
						setLikeCount(typeof shopData.likes === 'number' ? shopData.likes : 0);
						
						// Check if shop is liked by the current user
						if (user && user.id) {
							const userShopLikesRef = doc(db, 'users', user.id, 'likedShops', shopInfo.id);
							const userShopLikesSnap = await getDoc(userShopLikesRef);
							setIsLiked(userShopLikesSnap.exists());
						}

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
							likes: data.likes || 0,
						};
					});

				setSimilarProducts(fetchedProducts);
			} catch (error) {
				console.error('Error fetching similar products:', error);
			}
		};

		fetchSimilarProducts();
	}, [product]);

	const handleShopLike = async () => {
		if (!shop) return;
		
		try {
			const shopRef = doc(db, 'shops', shop.id);
			
			// Reference to track user likes
			const userLikeRef = doc(db, 'users', user?.id || 'anonymous', 'likedShops', shop.id);
			
			if (isLiked) {
				// Unlike: decrement likes
				await updateDoc(shopRef, {
					likes: increment(-1)
				});
				
				// Remove from user's liked shops
				if (user) {
					await deleteDoc(userLikeRef);
				}
				
				setLikeCount(prev => Math.max(0, prev - 1));
				setIsLiked(false);
				
				Toast.show({
					type: 'info',
					text1: 'Removed Like',
					text2: `You unliked ${shop.name}`,
				});
			} else {
				// Like: increment likes
				await updateDoc(shopRef, {
					likes: increment(1)
				});
				
				// Add to user's liked shops
				if (user) {
					await setDoc(userLikeRef, {
						shopId: shop.id,
						shopName: shop.name,
						timestamp: new Date()
					});
				}
				
				setLikeCount(prev => prev + 1);
				setIsLiked(true);
				
				Toast.show({
					type: 'success',
					text1: 'Liked!',
					text2: `You liked ${shop.name}`,
				});
			}
		} catch (error) {
			console.error('Error updating shop likes:', error);
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'Failed to update shop like status',
			});
		}
	};
	
	const handleProductLike = async () => {
		if (!product) return;
		
		try {
			const productRef = doc(db, 'products', product.id);
			
			// Reference to track user likes
			const userLikeRef = doc(db, 'users', user?.id || 'anonymous', 'likedProducts', product.id);
			
			if (isProductLiked) {
				// Unlike: decrement likes
				await updateDoc(productRef, {
					likes: increment(-1)
				});
				
				// Remove from user's liked products
				if (user) {
					await deleteDoc(userLikeRef);
				}
				
				setProductLikes(prev => Math.max(0, prev - 1));
				setIsProductLiked(false);
				
				Toast.show({
					type: 'info',
					text1: 'Removed Like',
					text2: `You unliked ${product.name}`,
				});
			} else {
				// Like: increment likes
				await updateDoc(productRef, {
					likes: increment(1)
				});
				
				// Add to user's liked products
				if (user) {
					await setDoc(userLikeRef, {
						productId: product.id,
						productName: product.name,
						timestamp: new Date()
					});
				}
				
				setProductLikes(prev => prev + 1);
				setIsProductLiked(true);
				
				Toast.show({
					type: 'success',
					text1: 'Liked!',
					text2: `You liked ${product.name}`,
				});
			}
		} catch (error) {
			console.error('Error updating product likes:', error);
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'Failed to update product like status',
			});
		}
	};

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
			userEmail: user?.email,
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
				userEmail: user?.email,
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
			<View style={styles.carouselFooter}>
				<Text style={styles.carouselPrice}>৳{item.price.toFixed(2)}</Text>
				{item.likes !== undefined && item.likes > 0 && (
					<View style={styles.carouselLikes}>
						<Ionicons name="heart" size={12} color={colors.likeButton} />
						<Text style={styles.carouselLikesText}>{item.likes}</Text>
					</View>
				)}
			</View>
		</TouchableOpacity>
	);

	if (loading) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
				<ActivityIndicator size='large' color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textLight }]}>
					Loading product...
				</Text>
			</View>
		);
	}

	if (!product) {
		return (
			<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
				<Text style={[styles.errorText, { color: colors.error }]}>Product not found</Text>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
			<StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} backgroundColor={colors.primary} />
			
			{/* Enhanced Header with gradient */}
			<LinearGradient
				colors={[colors.primary, colors.primaryLight]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={styles.header}
			>
				<TouchableOpacity 
					style={styles.backButton} 
					onPress={() => router.back()}
				>
					<Ionicons name="arrow-back" size={24} color="#fff" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Product Details</Text>
				<TouchableOpacity 
					style={styles.likeButton} 
					onPress={handleShopLike}
				>
					<Ionicons 
						name={isLiked ? "heart" : "heart-outline"} 
						size={24} 
						color={isLiked ? colors.likeButton : "#fff"} 
					/>
					{likeCount > 0 && (
						<Text style={styles.likeCount}>{likeCount}</Text>
					)}
				</TouchableOpacity>
			</LinearGradient>

			<ScrollView 
				style={styles.scrollView} 
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 120 }}
			>
				{/* Enhanced Product Image with Price Overlay */}
				<View style={styles.imageContainer}>
					<Image source={{ uri: product.image }} style={styles.productImage} />
					<View style={styles.imageOverlay}>
						<LinearGradient
							colors={[colors.primary, colors.primaryLight]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							style={styles.priceTag}
						>
							<Text style={styles.priceTagText}>৳{product.price.toFixed(2)}</Text>
							<Text style={styles.priceTagUnit}>per {product.unit}</Text>
						</LinearGradient>
					</View>
				</View>

				{/* Enhanced Product Information Card */}
				<View style={[styles.productContainer, { backgroundColor: colors.card }]}>
					<View style={styles.productHeader}>
						<Text style={[styles.productName, { color: colors.text }]}>
							{product.name}
						</Text>
						<View style={styles.productTypeRow}>
							<View style={[styles.productTypeContainer, { backgroundColor: `${colors.primaryLight}20` }]}>
								<MaterialCommunityIcons
									name="leaf"
									size={16}
									color={colors.primary}
								/>
								<Text style={[styles.productType, { color: colors.primary }]}>
									{product.type || 'Fresh Product'}
								</Text>
							</View>
							<TouchableOpacity 
								style={[styles.productLikeButton, 
									{ backgroundColor: isProductLiked ? `${colors.likeButton}15` : colors.cardAlt }
								]} 
								onPress={handleProductLike}
							>
								<Ionicons 
									name={isProductLiked ? "heart" : "heart-outline"} 
									size={20} 
									color={isProductLiked ? colors.likeButton : colors.textLight} 
								/>
								{productLikes > 0 && (
									<Text 
										style={[styles.productLikeCount, 
											{ color: isProductLiked ? colors.likeButton : colors.textLight }
										]}
									>
										{productLikes}
									</Text>
								)}
							</TouchableOpacity>
						</View>
					</View>

					<Text style={[styles.description, { color: colors.textLight }]}>
						{product.description || 'Fresh and quality product from local farmers. Organically grown with care and delivered fresh to your doorstep.'}
					</Text>
				</View>

				{/* Enhanced Shop Information Card */}
				{shop && (
					<View style={[styles.shopCard, { backgroundColor: colors.card }]}>
						<View style={styles.shopHeader}>
							<View style={[styles.shopImageContainer, { borderColor: `${colors.primary}30` }]}>
								{shop.image ? (
									<Image source={{ uri: shop.image }} style={styles.shopImage} />
								) : (
									<View style={[styles.shopImagePlaceholder, { backgroundColor: `${colors.primary}15` }]}>
										<Ionicons name="storefront" size={32} color={colors.primary} />
									</View>
								)}
							</View>
							<View style={styles.shopInfo}>
								<Text style={[styles.shopName, { color: colors.text }]}>{shop.name}</Text>
								<Text style={[styles.farmerInfo, { color: colors.textLight }]}>
									Farmer ID: {shop.farmerId}
								</Text>
								<View style={styles.shopMetrics}>
									{shop.rating && shop.rating > 0 && (
										<View style={[styles.ratingContainer, { backgroundColor: `${colors.warning}15` }]}>
											<Ionicons name="star" size={16} color={colors.warning} />
											<Text style={[styles.ratingText, { color: colors.warning }]}>
												{shop.rating.toFixed(1)}
											</Text>
										</View>
									)}
									{likeCount > 0 && (
										<View style={[styles.likesContainer, { backgroundColor: `${colors.likeButton}15` }]}>
											<Ionicons name="heart" size={16} color={colors.likeButton} />
											<Text style={[styles.likesText, { color: colors.likeButton }]}>
												{likeCount}
											</Text>
										</View>
									)}
								</View>
							</View>
						</View>

						{/* Enhanced Shop Details */}
						<View style={[styles.shopDetails, { borderTopColor: `${colors.border}` }]}>
							<View style={[styles.shopDetailRow, { backgroundColor: colors.cardAlt }]}>
								<Ionicons name="cube-outline" size={20} color={colors.primary} />
								<Text style={[styles.shopDetailText, { color: colors.textLight }]}>
									{product.name}: {product.stock} {product.unit} available
								</Text>
							</View>
							
							<View style={[styles.shopDetailRow, { backgroundColor: colors.cardAlt }]}>
								<Ionicons name="location-outline" size={20} color={colors.primary} />
								<Text style={[styles.shopDetailText, { color: colors.textLight }]}>
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
								<View style={[styles.distanceRow, { backgroundColor: `${colors.primary}10` }]}>
									<View style={styles.distanceInfo}>
										<Ionicons name="navigate" size={20} color={colors.primary} />
										<Text style={[styles.distanceText, { color: colors.primary }]}>
											{formatDistance(distance)} away
										</Text>
									</View>
									<TouchableOpacity 
										style={[styles.directionsButton, { backgroundColor: colors.primary }]}
										onPress={handleGetDirections}
									>
										<Ionicons name="navigate-outline" size={16} color="#fff" />
										<Text style={styles.directionsButtonText}>Get Directions</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>
					</View>
				)}

				{/* Shop Products Stock Section */}
				{shopProducts.length > 1 && (
					<View style={[styles.shopCard, { backgroundColor: colors.card }]}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>Available Stock</Text>
						
						{shopProducts.map((item) => (
							<View key={item.id} style={[styles.stockItem, { backgroundColor: colors.cardAlt, borderLeftColor: colors.primary }]}>
								<View style={styles.stockItemLeft}>
									<Text style={[styles.stockItemName, { color: colors.text }]}>{item.name}</Text>
									<Text style={[styles.stockItemUnit, { color: colors.textLight }]}>({item.unit})</Text>
								</View>
								<View style={[styles.stockItemRight, { backgroundColor: `${colors.primary}15` }]}>
									<Text style={[styles.stockItemCount, { color: colors.primary }]}>{item.stock}</Text>
								</View>
							</View>
						))}
					</View>
				)}

				{/* Enhanced Similar Products Section */}
				{similarProducts.length > 0 && (
					<View style={styles.similarSection}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>More from this shop</Text>
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
				
				{/* Bottom padding to prevent overlap with sticky button */}
				<View style={styles.bottomPadding} />
			</ScrollView>

			{/* Enhanced Sticky Add to Cart Button */}
			<View style={[styles.bottomContainer, { backgroundColor: colors.card }]}>
				{isOutOfStock ? (
					<View style={[styles.outOfStockContainer, { backgroundColor: `${colors.error}15` }]}>
						<Ionicons name="alert-circle" size={22} color={colors.error} />
						<Text style={[styles.outOfStockText, { color: colors.error }]}>
							Out of stock! We have other products available.
						</Text>
					</View>
				) : (
					<LinearGradient
						colors={[colors.primary, colors.primaryLight]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={[styles.addToCartButton, addingToCart && styles.addToCartButtonDisabled]}
					>
						<TouchableOpacity
							style={styles.addToCartButtonContent}
							onPress={handleAddToCart}
							disabled={addingToCart}
						>
							{addingToCart ? (
								<ActivityIndicator color="#fff" size="small" />
							) : (
								<>
									<Ionicons name="cart" size={22} color="#fff" />
									<Text style={styles.addToCartText}>Add to Cart</Text>
								</>
							)}
						</TouchableOpacity>
					</LinearGradient>
				)}
			</View>
		</SafeAreaView>
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
	},
	loadingText: {
		fontSize: 16,
		marginTop: 10,
		fontWeight: '500',
	},
	errorText: {
		fontSize: 18,
		textAlign: 'center',
		marginTop: 20,
		fontWeight: '500',
	},
	// Modern header with gradient
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 14,
		paddingTop: 48,
		elevation: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 6,
	},
	backButton: {
		padding: 10,
		borderRadius: 24,
		backgroundColor: 'rgba(255,255,255,0.15)',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#fff',
		letterSpacing: 0.5,
	},
	likeButton: {
		padding: 10,
		borderRadius: 24,
		backgroundColor: 'rgba(255,255,255,0.15)',
		flexDirection: 'row',
		alignItems: 'center',
	},
	likeCount: {
		color: '#fff',
		marginLeft: 4,
		fontSize: 14,
		fontWeight: '600',
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 100,
	},
	// Enhanced image container with overlay
	imageContainer: {
		width: '100%',
		height: 300,
		position: 'relative',
	},
	productImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	imageOverlay: {
		position: 'absolute',
		bottom: 16,
		right: 16,
	},
	priceTag: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 20,
		alignItems: 'center',
		minWidth: 100,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 4,
	},
	priceTagText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: '700',
	},
	priceTagUnit: {
		color: 'rgba(255,255,255,0.8)',
		fontSize: 12,
		fontWeight: '500',
		marginTop: 2,
	},
	// Enhanced product info section
	productContainer: {
		margin: 16,
		borderRadius: 16,
		padding: 20,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	productHeader: {
		marginBottom: 16,
	},
	productName: {
		fontSize: 24,
		fontWeight: '700',
		marginBottom: 6,
		lineHeight: 30,
	},
	productTypeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	productTypeContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 12,
	},
	productType: {
		fontSize: 14,
		fontWeight: '500',
		marginLeft: 6,
	},
	productLikeButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 12,
	},
	productLikeCount: {
		marginLeft: 4,
		fontSize: 12,
		fontWeight: '600',
	},
	description: {
		fontSize: 16,
		lineHeight: 26,
		marginBottom: 20,
		fontWeight: '400',
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 16,
		marginTop: 8,
		paddingHorizontal: 16,
	},
	// Enhanced shop card
	shopCard: {
		borderRadius: 16,
		margin: 16,
		padding: 20,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	shopHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
	},
	shopImageContainer: {
		width: 70,
		height: 70,
		borderRadius: 35,
		overflow: 'hidden',
		marginRight: 16,
		borderWidth: 3,
	},
	shopImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	shopImagePlaceholder: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
	},
	shopInfo: {
		flex: 1,
	},
	shopName: {
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 4,
	},
	farmerInfo: {
		fontSize: 14,
		marginBottom: 8,
		fontWeight: '500',
	},
	shopMetrics: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
	},
	ratingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	ratingText: {
		marginLeft: 4,
		fontWeight: '600',
		fontSize: 14,
	},
	likesContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	likesText: {
		marginLeft: 4,
		fontWeight: '600',
		fontSize: 14,
	},
	shopDetails: {
		marginTop: 12,
		paddingTop: 16,
		borderTopWidth: 1,
	},
	shopDetailRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
		padding: 12,
		borderRadius: 12,
	},
	shopDetailText: {
		fontSize: 14,
		marginLeft: 12,
		fontWeight: '500',
		flex: 1,
	},
	distanceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 12,
		borderRadius: 12,
		marginTop: 8,
	},
	distanceInfo: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	distanceText: {
		fontSize: 14,
		marginLeft: 8,
		fontWeight: '700',
	},
	directionsButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 16,
	},
	directionsButtonText: {
		fontSize: 12,
		color: '#fff',
		marginLeft: 6,
		fontWeight: '600',
	},
	// Enhanced similar products section
	similarSection: {
		marginTop: 8,
		paddingBottom: 120, // Increased padding to prevent overlap with sticky button
	},
	similarList: {
		paddingHorizontal: 16,
		paddingBottom: 20, // Additional padding for the horizontal list
	},
	carouselItem: {
		width: 160,
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 16,
		marginRight: 12,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	carouselImage: {
		width: 128,
		height: 120,
		borderRadius: 12,
		marginBottom: 12,
	},
	carouselName: {
		fontSize: 14,
		fontWeight: '600',
		color: '#333',
		textAlign: 'center',
		marginBottom: 6,
		lineHeight: 18,
	},
	carouselFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	carouselPrice: {
		fontSize: 16,
		color: '#4a6b4f',
		fontWeight: '700',
	},
	carouselLikes: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#ffebee',
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 8,
	},
	carouselLikesText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#e91e63',
		marginLeft: 2,
	},
	// Enhanced sticky bottom container
	bottomContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 40,
		elevation: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		borderTopWidth: 1,
		borderTopColor: 'rgba(0,0,0,0.05)',
	},
	addToCartButton: {
		borderRadius: 20,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 6,
	},
	addToCartButtonContent: {
		paddingVertical: 18,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
	},
	addToCartText: {
		color: '#fff',
		fontWeight: '700',
		fontSize: 16,
		marginLeft: 8,
		letterSpacing: 0.5,
	},
	addToCartButtonDisabled: {
		opacity: 0.7,
	},
	bottomPadding: {
		height: 100, // Increased height to ensure no overlap with sticky button
	},
	// Stock item styles
	stockItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginBottom: 8,
		borderRadius: 12,
		borderLeftWidth: 3,
	},
	stockItemLeft: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	stockItemName: {
		fontSize: 16,
		fontWeight: '600',
		marginRight: 6,
	},
	stockItemUnit: {
		fontSize: 12,
		fontWeight: '500',
	},
	stockItemRight: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 10,
	},
	stockItemCount: {
		fontSize: 16,
		fontWeight: '700',
	},
	// Out of stock styles
	outOfStockContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderRadius: 20,
	},
	outOfStockText: {
		marginLeft: 8,
		fontSize: 16,
		fontWeight: '600',
	},
});

export default ProductDetailScreen;
