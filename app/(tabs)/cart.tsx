import {
	View,
	Text,
	FlatList,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	TextInput,
	Alert,
	Modal,
	Image,
	useColorScheme,
	StatusBar,
	Dimensions,
	ScrollView,
	SectionList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useCart } from '../../context/CartProvider';
import {
	collection,
	addDoc,
	getFirestore,
	doc,
	setDoc,
	getDoc,
} from 'firebase/firestore';
import { app } from '../../config/firebase';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import LocationSelector, { LocationData } from '../../components/LocationSelector';
import { initiateSSLCommerzPayment, generateTransactionId, PaymentData } from '../../utils/sslcommerz';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function CartScreen() {
	const {
		cartItems,
		total,
		removeFromCart,
		updateQuantity,
		clearCart,
		loading,
		refreshCart,
		removeShopItems
	} = useCart();
	const { user } = useAuth();
	const [placingOrder, setPlacingOrder] = useState(false);
	const [deliveryAddress, setDeliveryAddress] = useState('');
	const [paymentMethod, setPaymentMethod] = useState('');
	const [isModalVisible, setIsModalVisible] = useState(false);
	const [isLocationSelectorVisible, setIsLocationSelectorVisible] = useState(false);
	const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
	const [processingPayment, setProcessingPayment] = useState(false);
	const [advancePaymentAmount, setAdvancePaymentAmount] = useState(0);
	const [showAdvancePaymentModal, setShowAdvancePaymentModal] = useState(false);
	const [currentShopId, setCurrentShopId] = useState<string | null>(null);
	const db = getFirestore(app);
	const navigation = useNavigation();
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];
	
	// Calculate advance payment (10% for COD)
	const calculateAdvancePayment = (total: number, paymentMethod: string) => {
		if (paymentMethod === 'cash_on_delivery') {
			return Math.round(total * 0.1 * 100) / 100; // 10% rounded to 2 decimals
		}
		return 0;
	};

	// Update advance payment when total or payment method changes
	useEffect(() => {
		const advance = calculateAdvancePayment(total, paymentMethod);
		setAdvancePaymentAmount(advance);
	}, [total, paymentMethod]);

	// Utility function to format location data
	const formatLocationForStorage = (location: LocationData) => {
		const formatted = {
			'latitude(number/string)': location.latitude.toString(),
			'longitude(number/string)': location.longitude.toString(),
		};
		
		// Log in the exact format requested
		console.log('delivery location(map):');
		console.log(`   latitude(number/string): ${formatted['latitude(number/string)']}`);
		console.log(`   longitude(number/string): ${formatted['longitude(number/string)']}`);
		
		return formatted;
	};

	const toggleModal = () => {
		setIsModalVisible(!isModalVisible);
	};

	useEffect(() => {
		if (!user) return;

		// Fetch user delivery address and payment method from database
		const fetchUserDetails = async () => {
			try {
				const userDoc = await getDoc(doc(db, 'users', user.id));
				if (userDoc.exists()) {
					const userData = userDoc.data();
					setDeliveryAddress(userData.deliveryAddress || '');
					setPaymentMethod(userData.paymentMethod || '');
					
					// Load saved location
					if (userData.deliveryLocation) {
						setSelectedLocation(userData.deliveryLocation);
					}
				}
				
				// Also try to load from AsyncStorage as backup
				const savedLocation = await AsyncStorage.getItem(`deliveryLocation_${user.id}`);
				if (savedLocation && !selectedLocation) {
					setSelectedLocation(JSON.parse(savedLocation));
				}
			} catch (error) {
				console.error('Error fetching user details:', error);
			}
		};

		fetchUserDetails();
	}, [user]);

	const handleSetDetails = async () => {
		if (!user) {
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'User is not logged in.',
			});
			return;
		}

		if (!deliveryAddress || !paymentMethod) {
			Alert.alert(
				'Missing Information',
				'Please provide both delivery address and payment method.'
			);
			return;
		}

		try {
			const updateData: any = {
				deliveryAddress,
				paymentMethod,
			};

			// Include location data if available in the requested format
			if (selectedLocation) {
				updateData.deliveryLocation = selectedLocation; // Keep full location data
				updateData['delivery location(map)'] = formatLocationForStorage(selectedLocation);
				
				console.log('Storing delivery location (map):', updateData['delivery location(map)']);
				
				// Also save to AsyncStorage as backup
				await AsyncStorage.setItem(
					`deliveryLocation_${user.id}`,
					JSON.stringify(selectedLocation)
				);
			}

			await setDoc(doc(db, 'users', user.id), updateData, { merge: true });

			Toast.show({
				type: 'success',
				text1: 'Details Saved',
				text2: 'Your delivery details have been updated.',
			});
		} catch (error) {
			console.error('Error saving user details:', error);
			Toast.show({
				type: 'error',
				text1: 'Save Failed',
				text2: 'Failed to save your details.',
			});
		}
	};

	const handleLocationSelect = (location: LocationData) => {
		setSelectedLocation(location);
		setDeliveryAddress(location.address);
		
		// Format and log location in the requested format
		formatLocationForStorage(location);
	};

	const initiateOnlinePayment = async (orderId: string, isAdvancePayment: boolean = false, shopTotal: number = 0) => {
		if (!user) return false;

		try {
			setProcessingPayment(true);
			
			// Use orderId as transaction ID for easier tracking
			const transactionId = orderId;
			const customerName = user.name || user.email.split('@')[0];
			const address = selectedLocation?.address || deliveryAddress || 'Dhaka, Bangladesh';
			
			// Calculate payment amount based on payment type and shop total
			const paymentAmount = isAdvancePayment ? 
				calculateShopAdvancePayment(shopTotal, paymentMethod) : 
				shopTotal;
				
			const productDescription = isAdvancePayment 
				? `Advance Payment (10%) for Order #${orderId}` 
				: `Agricultural Products Order #${orderId}`;
			
			// Validate required fields
			if (!customerName || !address) {
				throw new Error('Customer name and address are required for payment');
			}
			
			const paymentData: PaymentData = {
				total_amount: paymentAmount,
				currency: 'BDT',
				tran_id: transactionId,
				success_url: 'https://yourapp.com/payment/success',
				fail_url: 'https://yourapp.com/payment/fail',
				cancel_url: 'https://yourapp.com/payment/cancel',
				ipn_url: 'https://yourapp.com/payment/ipn',
				shipping_method: 'Courier',
				product_name: productDescription,
				product_category: 'Agricultural Products',
				product_profile: 'general',
				cus_name: customerName,
				cus_email: user.email,
				cus_add1: address,
				cus_add2: selectedLocation?.name || '',
				cus_city: 'Dhaka',
				cus_state: 'Dhaka',
				cus_postcode: '1000',
				cus_country: 'Bangladesh',
				cus_phone: '01700000000',
				cus_fax: '',
				ship_name: customerName,
				ship_add1: address,
				ship_add2: selectedLocation?.name || '',
				ship_city: 'Dhaka',
				ship_state: 'Dhaka',
				ship_postcode: '1000',
				ship_country: 'Bangladesh',
				value_a: orderId,
				value_b: user.id,
				value_c: isAdvancePayment ? 'advance_payment' : 'full_payment',
				value_d: new Date().toISOString(),
			};

			console.log('Payment Data:', paymentData);

			// Store payment info for verification
			await AsyncStorage.setItem(`pending_payment_${orderId}`, JSON.stringify({
				orderId,
				amount: paymentAmount,
				isAdvancePayment,
				totalAmount: shopTotal,
				timestamp: Date.now(),
			}));

			const result = await initiateSSLCommerzPayment(paymentData);
			
			if (result.success) {
				Toast.show({
					type: 'success',
					text1: 'Payment Initiated',
					text2: `Redirecting to payment gateway for ৳${paymentAmount.toFixed(2)}...`,
				});
				return true;
			} else {
				throw new Error(result.error);
			}
		} catch (error) {
			console.error('Payment initiation error:', error);
			Toast.show({
				type: 'error',
				text1: 'Payment Failed',
				text2: 'Failed to initiate online payment',
			});
			return false;
		} finally {
			setProcessingPayment(false);
		}
	};

	const handlePlaceOrder = async (shopId: string) => {
		if (!user) {
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'User is not logged in.',
			});
			return;
		}

		const shopItems = cartItems.filter(item => item.shopId === shopId);
		if (shopItems.length === 0) {
			Toast.show({
				type: 'error',
				text1: 'Order Failed',
				text2: 'No items for this shop',
			});
			return;
		}

		if (!paymentMethod) {
			Toast.show({
				type: 'error',
				text1: 'Payment Method Required',
				text2: 'Please select a payment method',
			});
			return;
		}
		
		// Store the current shop ID for the order process
		setCurrentShopId(shopId);

		// For Cash on Delivery, show advance payment modal
		if (paymentMethod === 'cash_on_delivery') {
			setShowAdvancePaymentModal(true);
			return;
		}

		// For online payment, proceed normally
		await proceedWithOrder(false, shopId);
	};

	const proceedWithOrder = async (isAdvancePayment: boolean = false, shopId: string = currentShopId || '') => {
		if (!user || !shopId) return;

		setPlacingOrder(true);
		try {
			// Filter items for this specific shop
			const shopItems = cartItems.filter(item => item.shopId === shopId);
			if (shopItems.length === 0) {
				throw new Error('No items found for this shop');
			}
			
			// Calculate total for this shop
			const shopTotal = shopItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
			const shopAdvancePayment = calculateShopAdvancePayment(shopTotal, paymentMethod);
			
			// Generate a unique order ID that we'll use as transaction ID for online payments
			const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
			
			// Find shop name
			const shopName = shopItems[0].shopName || 'Unknown Shop';
			
			// Create order document with shop information
			const orderData: any = {
				userId: user.id,
				userEmail: user.email,
				items: shopItems.map((item) => ({
					id: item.id,
					name: item.name,
					price: item.price,
					quantity: item.quantity,
					unit: item.unit,
					image: item.image || '',
					shopId: item.shopId,
					shopName: item.shopName,
					farmerId: item.farmerId,
				})),
				total: shopTotal,
				shopId: shopId,
				shopName: shopName,
				status: 'pending',
				createdAt: new Date(),
				deliveryAddress: selectedLocation?.address || deliveryAddress,
				deliveryLocation: selectedLocation,
				paymentMethod: paymentMethod,
				paymentStatus: paymentMethod === 'online_payment' ? 'pending' : 
							   (isAdvancePayment ? 'advance_paid' : 'cash_on_delivery'),
				advancePaymentAmount: isAdvancePayment ? shopAdvancePayment : 0,
				remainingAmount: isAdvancePayment ? (shopTotal - shopAdvancePayment) : 0,
			};

			// Add location in the requested format if available
			if (selectedLocation) {
				orderData['delivery location(map)'] = formatLocationForStorage(selectedLocation);
				console.log('Order delivery location (map):', orderData['delivery location(map)']);
			}

			// Create order with specific ID for online payments
			const orderRef = doc(db, 'orders', orderId);
			await setDoc(orderRef, orderData);
			
			// Update product stock in Firestore for each ordered item
			const stockUpdatePromises = shopItems.map(async (item) => {
				try {
					const productRef = doc(db, 'products', item.id);
					const productSnap = await getDoc(productRef);
					
					if (productSnap.exists()) {
						const productData = productSnap.data();
						const currentStock = productData.stock || 0;
						const newStock = Math.max(0, currentStock - item.quantity);
						
						console.log(`Updating stock for product ${item.id}: ${currentStock} -> ${newStock}`);
						
						// Update the stock in Firestore
						await setDoc(
							productRef, 
							{ 
								stock: newStock,
								lastUpdated: new Date()
							}, 
							{ merge: true }
						);
					}
				} catch (error) {
					console.error(`Error updating stock for product ${item.id}:`, error);
				}
			});
			
			// Wait for all stock updates to complete
			await Promise.all(stockUpdatePromises);
			console.log('All product stocks updated successfully');

			// Handle payment based on method
			if (paymentMethod === 'online_payment') {
				const paymentSuccess = await initiateOnlinePayment(orderId, false, shopTotal);
				if (!paymentSuccess) {
					// If payment fails, we keep the order but mark it as payment failed
					await setDoc(orderRef, { paymentStatus: 'failed' }, { merge: true });
					return;
				}
			} else if (paymentMethod === 'cash_on_delivery' && isAdvancePayment) {
				// Handle advance payment for COD
				const paymentSuccess = await initiateOnlinePayment(orderId, true, shopTotal);
				if (!paymentSuccess) {
					// If advance payment fails, we keep the order but mark it as payment failed
					await setDoc(orderRef, { paymentStatus: 'failed' }, { merge: true });
					return;
				}
			}

			// Remove only the items from this shop from the user's cart
			const remainingItems = cartItems.filter(item => item.shopId !== shopId);
			
			// Update the cart with the remaining items
			const cartRef = doc(db, 'carts', user.id);
			await setDoc(cartRef, { 
				items: remainingItems,
				userEmail: user.email, // Include user email with cart data
				lastUpdated: new Date()
			});
			
			// Use our new function to remove only this shop's items from the cart
			removeShopItems(shopId);
			
			Toast.show({
				type: 'info',
				text1: 'Cart Updated',
				text2: 'Items from other shops remain in your cart',
				position: 'bottom',
			});

			const orderMessage = isAdvancePayment 
				? `Order #${orderId} placed with ${shopName}! Advance payment of ৳${shopAdvancePayment.toFixed(2)} processed. Remaining ৳${(shopTotal - shopAdvancePayment).toFixed(2)} will be collected on delivery.`
				: `Order #${orderId} placed successfully with ${shopName}!`;

			Toast.show({
				type: 'success',
				text1: 'Order Successful',
				text2: orderMessage,
			});
			
			setShowAdvancePaymentModal(false);
			setCurrentShopId(null);

			// Navigate to orders page
			navigation.navigate('orders' as never);
		} catch (error) {
			console.error('Error placing order:', error);
			Toast.show({
				type: 'error',
				text1: 'Order Failed',
				text2: 'Failed to place order',
			});
		} finally {
			setPlacingOrder(false);
		}
	};

	// Group cart items by shop
	const groupCartItemsByShop = () => {
		// Create a map of shops with their items
		const shopMap = new Map();
		
		cartItems.forEach(item => {
			const shopId = item.shopId || 'unknown';
			const shopName = item.shopName || 'Unknown Shop';
			
			if (!shopMap.has(shopId)) {
				shopMap.set(shopId, {
					shopId,
					shopName,
					items: [],
					total: 0
				});
			}
			
			const shop = shopMap.get(shopId);
			shop.items.push(item);
			shop.total += item.price * item.quantity;
		});
		
		// Convert map to array for SectionList
		return Array.from(shopMap.values()).map(shop => ({
			shopId: shop.shopId,
			shopName: shop.shopName,
			total: shop.total,
			data: shop.items
		}));
	};
	
	const shopSections = groupCartItemsByShop();
	
	// Calculate shop-specific total
	const getShopTotal = (shopId: string) => {
		return cartItems
			.filter(item => item.shopId === shopId)
			.reduce((sum, item) => sum + (item.price * item.quantity), 0);
	};

	// Calculate advance payment for a specific shop (10% for COD)
	const calculateShopAdvancePayment = (shopTotal: number, paymentMethod: string) => {
		if (paymentMethod === 'cash_on_delivery') {
			return Math.round(shopTotal * 0.1 * 100) / 100; // 10% rounded to 2 decimals
		}
		return 0;
	};

	// Add a function to refresh the cart
	const onRefresh = async () => {
		try {
			if (refreshCart) {
				await refreshCart();
				
				// Check if any items are at stock limit
				const stockLimitItems = cartItems.filter(item => item.stockLimit);
				
				if (stockLimitItems.length > 0) {
					Toast.show({
						type: 'info',
						text1: 'Stock Information Updated',
						text2: `${stockLimitItems.length} item(s) have reached stock limits`,
						position: 'bottom',
					});
				} else {
					Toast.show({
						type: 'success',
						text1: 'Cart Refreshed',
						text2: 'Your cart has been updated with latest stock information',
						position: 'bottom',
					});
				}
			}
		} catch (error) {
			console.error('Error refreshing cart:', error);
			Toast.show({
				type: 'error',
				text1: 'Refresh Failed',
				text2: 'Could not update cart information',
				position: 'bottom',
			});
		}
	};

	if (loading) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
				<ActivityIndicator size='large' color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textLight }]}>Loading your cart...</Text>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
			
			{cartItems.length === 0 ? (
				<View style={styles.emptyContainer}>
					<LinearGradient
						colors={[`${colors.primary}20`, `${colors.primary}05`]}
						style={styles.emptyGradient}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
					>
						<Ionicons name='cart-outline' size={80} color={colors.primary} />
					</LinearGradient>
					<Text style={[styles.emptyText, { color: colors.text }]}>Your cart is empty</Text>
					<Text style={[styles.emptySubtext, { color: colors.textLight }]}>
						Browse our fresh agricultural products and add some items to your cart
					</Text>
					<TouchableOpacity
						style={[styles.shopNowButton, { backgroundColor: colors.primary }]}
						onPress={() => navigation.navigate('index' as never)}
					>
						<Text style={styles.shopNowButtonText}>Shop Now</Text>
						<Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
					</TouchableOpacity>
				</View>
			) : (
				<>
					<View style={styles.headerContainer}>
						<LinearGradient
							colors={[colors.primary, colors.primaryLight]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							style={styles.headerGradient}
						>
							<View style={styles.headerContent}>
								<Text style={styles.headerTitle}>My Cart</Text>
								<Text style={styles.headerSubtitle}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Text>
							</View>
						</LinearGradient>
					</View>
				
					<SectionList
						sections={shopSections}
						keyExtractor={(item) => item.id}
						refreshing={loading}
						onRefresh={onRefresh}
						renderSectionHeader={({ section }) => (
							<View style={[styles.shopHeader, { backgroundColor: colors.cardAlt }]}>
								<View style={styles.shopHeaderLeft}>
									<Ionicons name="storefront" size={20} color={colors.primary} />
									<Text style={[styles.shopHeaderName, { color: colors.text }]}>
										{section.shopName}
									</Text>
								</View>
								
								{paymentMethod && (
									<TouchableOpacity
										style={[styles.placeOrderButton, { 
											backgroundColor: paymentMethod === 'cash_on_delivery' ? 
												colors.warning : colors.primary 
										}]}
										onPress={() => handlePlaceOrder(section.shopId)}
										disabled={placingOrder && currentShopId === section.shopId}
									>
										{placingOrder && currentShopId === section.shopId ? (
											<ActivityIndicator size="small" color="#fff" />
										) : (
											<>
												<Text style={styles.placeOrderButtonText}>Place Order</Text>
												<Ionicons 
													name={paymentMethod === 'cash_on_delivery' ? 'cash-outline' : 'card-outline'} 
													size={16} 
													color="#fff" 
													style={{ marginLeft: 4 }} 
												/>
											</>
										)}
									</TouchableOpacity>
								)}
							</View>
						)}
						renderItem={({ item }) => (
							<View style={[styles.cartCard, { backgroundColor: colors.card }]}>
								<View style={styles.itemImageWrapper}>
									<Image 
										source={{ uri: item.image || 'https://via.placeholder.com/150' }}
										style={styles.itemImage}
									/>
								</View>									<View style={styles.itemContent}>
									<View style={styles.itemInfo}>
										<Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
										<View style={styles.priceStockRow}>
											<Text style={[styles.itemPrice, { color: colors.primary }]}>
												৳{item.price.toFixed(2)}/{item.unit}
											</Text>
											
											{item.stockQty !== undefined && (
												<View style={[styles.stockBadge, { 
													backgroundColor: item.stockLimit 
														? `${colors.error}20` 
														: `${colors.success}20`,
													borderColor: item.stockLimit 
														? `${colors.error}50` 
														: `${colors.success}50`,
												}]}>
													<Ionicons 
														name={item.stockLimit ? 'alert-circle' : 'checkmark-circle'} 
														size={14} 
														color={item.stockLimit ? colors.error : colors.success} 
														style={styles.stockIcon}
													/>
													<Text style={[styles.stockInfo, { 
														color: item.stockLimit ? colors.error : colors.success,
														fontWeight: item.stockLimit ? 'bold' : 'normal'
													}]}>
														{item.stockLimit 
															? `${item.quantity}/${item.stockQty} (Max)` 
															: `${item.stockQty - item.quantity} more available`}
													</Text>
												</View>
											)}
										</View>
									</View>
									<View style={styles.itemActions}>
										<View style={[styles.quantityContainer, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>										<TouchableOpacity
											onPress={() => updateQuantity(item.id, item.quantity - 1)}
											disabled={item.quantity <= 1}
											style={[
												styles.quantityButton, 
												item.quantity <= 1 && styles.quantityButtonDisabled
											]}
										>
											<Ionicons
												name='remove'
												size={18}
												color={item.quantity <= 1 ? colors.textLight : colors.primary}
											/>
										</TouchableOpacity>										<Text style={[styles.quantity, { color: colors.text }]}>
											{item.quantity}
											{item.stockLimit && (
												<Text style={{ color: colors.error, fontSize: 12, fontWeight: 'bold' }}> (max)</Text>
											)}
										</Text>
										<TouchableOpacity
											onPress={() => {
												// Check product stock before increasing quantity
												const checkStock = async () => {
													try {
														const productRef = doc(db, 'products', item.id);
														const productSnap = await getDoc(productRef);
														
														if (productSnap.exists()) {
															const productData = productSnap.data();
															const stockQty = productData.stock || 0;
															
															if (item.quantity < stockQty) {
																// Pass the stock quantity to updateQuantity
																updateQuantity(item.id, item.quantity + 1, stockQty);
																
																// Show remaining stock in toast if getting low
																if (item.quantity + 1 >= stockQty - 3 && stockQty > 0) {
																	Toast.show({
																		type: 'info',
																		text1: 'Stock Running Low',
																		text2: `Only ${stockQty - (item.quantity + 1)} more available`,
																		position: 'bottom',
																	});
																}
															} else {
																// Update with current quantity but mark as at limit
																updateQuantity(item.id, item.quantity, stockQty);
																
																Toast.show({
																	type: 'error',
																	text1: 'Stock Limit',
																	text2: `Only ${stockQty} items available in stock`
																});
															}
														} else {
															updateQuantity(item.id, item.quantity + 1);
														}
													} catch (error) {
														console.error('Error checking stock:', error);
														updateQuantity(item.id, item.quantity + 1);
													}
												};
											
												checkStock();
											}}
											style={[
												styles.quantityButton,
												item.stockLimit && styles.quantityButtonDisabled
											]}
											disabled={item.stockLimit}
										>
											<Ionicons 
												name='add' 
												size={18} 
												color={item.stockLimit ? colors.textLight : colors.primary} 
											/>
											</TouchableOpacity>
										</View>
										<TouchableOpacity
											onPress={() => removeFromCart(item.id)}
											style={styles.removeButton}
										>
											<Ionicons name='trash-outline' size={20} color={colors.error} />
										</TouchableOpacity>
									</View>
								</View>
							</View>
						)}
						renderSectionFooter={({ section }) => (
							<View style={styles.shopFooter}>
								<View style={[styles.shopTotal, { backgroundColor: `${colors.primary}10` }]}>
									<Text style={{ color: colors.textLight }}>Shop Total:</Text>
									<Text style={[styles.shopTotalAmount, { color: colors.primary }]}>
										৳{section.total.toFixed(2)}
									</Text>
								</View>
								
								{/* Stock information summary for the shop */}
								{section.data.some((item: any) => item.stockQty !== undefined) && (
									<View style={styles.stockSummaryContainer}>
										{section.data.some((item: any) => item.stockLimit) && (
											<View style={[styles.stockWarning, { backgroundColor: `${colors.error}15`, borderColor: `${colors.error}30` }]}>
												<Ionicons name="alert-circle" size={16} color={colors.error} style={{ marginRight: 6 }} />
												<Text style={{ color: colors.error, fontSize: 13 }}>
													Some items have reached stock limits
												</Text>
											</View>
										)}
										
										<Text style={[styles.stockSummaryTitle, { color: colors.textLight }]}>
											Stock Information:
										</Text>
										
										{section.data.map((item: any) => (
											item.stockQty !== undefined && (
												<View key={`stock-${item.id}`} style={styles.stockSummaryItem}>
													<Text 
														numberOfLines={1} 
														ellipsizeMode="tail" 
														style={[styles.stockItemName, { color: colors.text }]}
													>
														{item.name}:
													</Text>
													<Text style={{ 
														color: item.stockLimit ? colors.error : colors.success,
														fontWeight: item.stockLimit ? 'bold' : 'normal',
														fontSize: 13
													}}>
														{item.quantity}/{item.stockQty} {item.unit}
													</Text>
												</View>
											)
										))}
									</View>
								)}
							</View>
						)}
						ListFooterComponent={() => (
							<View style={styles.cartFooter}>
								<View style={[styles.totalContainer, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
									<Text style={[styles.totalLabel, { color: colors.text }]}>Total Amount:</Text>
									<Text style={[styles.totalAmount, { color: colors.primary }]}>৳{total.toFixed(2)}</Text>
								</View>
								
								{paymentMethod === 'cash_on_delivery' && (
									<View style={[styles.advanceContainer, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}30` }]}>
										<Text style={[styles.advanceLabel, { color: colors.warning }]}>
											Advance Payment (10%):
										</Text>
										<Text style={[styles.advanceAmount, { color: colors.warning }]}>
											৳{advancePaymentAmount.toFixed(2)}
										</Text>
									</View>
								)}

								<View style={styles.actionButtons}>
									<TouchableOpacity
										style={[styles.clearButton, { borderColor: colors.error }]}
										onPress={clearCart}
									>
										<Ionicons name="trash-outline" size={18} color={colors.error} />
										<Text style={[styles.clearButtonText, { color: colors.error }]}>Clear</Text>
									</TouchableOpacity>

									<TouchableOpacity 
										style={styles.toggleButton}
										onPress={toggleModal}
									>
										<LinearGradient
											colors={[colors.primary, colors.primaryLight]}
											start={{ x: 0, y: 0 }}
											end={{ x: 1, y: 0 }}
											style={styles.toggleButtonGradient}
										>
											<Ionicons name="location-outline" size={20} color="#fff" />
											<Text style={styles.toggleButtonText}>Delivery Details</Text>
										</LinearGradient>
									</TouchableOpacity>

									{!paymentMethod && (
										<TouchableOpacity 
											style={styles.selectPaymentButton}
											onPress={toggleModal}
										>
											<LinearGradient
												colors={[colors.info, colors.blue]}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 0 }}
												style={styles.selectPaymentGradient}
											>
												<Ionicons name="card-outline" size={20} color="#fff" />
												{/* <Text style={styles.selectPaymentText}>Select Payment</Text> */}
											</LinearGradient>
										</TouchableOpacity>
									)}
								</View>
							</View>
						)}
						contentContainerStyle={{ paddingBottom: 120 }}
					/>

					<View style={styles.cartFooterSpacer} />

					<Modal
						visible={isModalVisible}
						animationType='slide'
						transparent={true}
						onRequestClose={toggleModal}
					>
						<View style={styles.modalContainer}>
							<View style={[styles.modalContent, { backgroundColor: colors.card }]}>
								<View style={styles.modalHeader}>
									<Text style={[styles.modalTitle, { color: colors.text }]}>Delivery Details</Text>
									<TouchableOpacity onPress={toggleModal} style={styles.modalCloseBtn}>
										<Ionicons name="close" size={24} color={colors.textLight} />
									</TouchableOpacity>
								</View>
								
								<ScrollView  showsVerticalScrollIndicator={false}>
									{/* Location Selection */}
									<View style={styles.locationSection}>
										<Text style={[styles.sectionLabel, { color: colors.text }]}>Delivery Location:</Text>
										<TouchableOpacity
											style={[styles.locationButton, { 
												borderColor: colors.primary,
												backgroundColor: `${colors.primary}05`
											}]}
											onPress={() => setIsLocationSelectorVisible(true)}
										>
											<Ionicons name="location-outline" size={20} color={colors.primary} />
											<Text style={[styles.locationButtonText, { color: colors.primary }]}>
												{selectedLocation ? 'Change Location' : 'Select Location on Map'}
											</Text>
										</TouchableOpacity>
										
										{selectedLocation && (
											<View style={[styles.selectedLocationContainer, { backgroundColor: `${colors.primary}10` }]}>
												<Text style={[styles.selectedLocationName, { color: colors.text }]}
												>
													{selectedLocation.name || 'Selected Location'}
												</Text>
												<Text style={[styles.selectedLocationAddress, { color: colors.textLight }]}
												>
													{selectedLocation.address}
												</Text>
												<View style={styles.coordinatesContainer}>
													<Text style={[styles.coordinatesTitle, { color: colors.primary }]}>Coordinates:</Text>
													<Text style={[styles.coordinatesText, { color: colors.textLight }]}
													>
														latitude: {selectedLocation.latitude.toString()}
													</Text>
													<Text style={[styles.coordinatesText, { color: colors.textLight }]}
													>
														longitude: {selectedLocation.longitude.toString()}
													</Text>
												</View>
											</View>
										)}
									</View>

									{/* Manual Address Input */}
									<Text style={[styles.sectionLabel, { color: colors.text }]}>Delivery Address:</Text>
									<TextInput
										style={[styles.input, { 
											borderColor: colors.border,
											backgroundColor: `${colors.primary}05`,
											color: colors.text
										}]}
										value={deliveryAddress}
										onChangeText={setDeliveryAddress}
										placeholder='Enter your delivery address'
										placeholderTextColor={colors.textLight}
										multiline
									/>

									{/* Payment Method */}
									<Text style={[styles.sectionLabel, { color: colors.text }]}>Payment Method:</Text>
									<View style={[styles.pickerContainer, { 
										borderColor: colors.border, 
										backgroundColor: `${colors.primary}05`
									}]}
									>
										<Picker
											selectedValue={paymentMethod}
											onValueChange={(itemValue) => setPaymentMethod(itemValue)}
											style={styles.picker}
											dropdownIconColor={colors.primary}
										>
											<Picker.Item label="Select Payment Method" value="" />
											<Picker.Item
												label='Cash on Delivery (10% advance required)'
												value='cash_on_delivery'
											/>
											<Picker.Item label='Online Payment (SSL Commerz)' value='online_payment' />
										</Picker>
									</View>

									{/* Payment Info */}
									{paymentMethod === 'online_payment' && (
										<View style={[styles.paymentInfo, { backgroundColor: `${colors.info}15` }]}>
											<Ionicons name="card-outline" size={20} color={colors.info} />
											<Text style={[styles.paymentInfoText, { color: colors.info }]}
											>
												You will be redirected to SSL Commerz for secure payment
											</Text>
										</View>
									)}

									{/* COD Advance Payment Info */}
									{paymentMethod === 'cash_on_delivery' && (
										<View style={[styles.codAdvanceInfo, { 
											backgroundColor: `${colors.warning}15`,
											borderColor: `${colors.warning}30`,
										}]}
										>
											<Ionicons name="cash-outline" size={20} color={colors.warning} />
											<Text style={[styles.codAdvanceInfoText, { color: colors.warning }]}
											>
												Cash on Delivery requires 10% advance payment (৳{advancePaymentAmount.toFixed(2)}) online. 
												Remaining ৳{(total - advancePaymentAmount).toFixed(2)} will be collected on delivery.
											</Text>
										</View>
									)}
									
									{/* Add padding at the bottom to ensure all content is accessible */}
									<View  />
								</ScrollView>

								{/* Button container with fixed position */}
								<View style={styles.modalButtonContainer}>
									<TouchableOpacity
										style={[styles.closeButton, { backgroundColor: colors.error }]}
										onPress={toggleModal}
									>
										<Text style={[styles.closeButtonText, { color: '#fff' }]}>Cancel</Text>
									</TouchableOpacity>
									
									<TouchableOpacity
										style={[styles.saveButton, { backgroundColor: colors.primary }]}
										onPress={handleSetDetails}
									>
										<Text style={styles.saveButtonText}>Save Details</Text>
									</TouchableOpacity>
								</View>
							</View>
						</View>
					</Modal>

					{/* Location Selector */}
					<LocationSelector
						visible={isLocationSelectorVisible}
						onClose={() => setIsLocationSelectorVisible(false)}
						onLocationSelect={handleLocationSelect}
						initialLocation={selectedLocation || undefined}
					/>

					{/* Advance Payment Modal for COD */}
					<Modal
						visible={showAdvancePaymentModal}
						animationType='slide'
						transparent={true}
						onRequestClose={() => setShowAdvancePaymentModal(false)}
					>
						<View style={styles.modalContainer}>
							<View style={[styles.advancePaymentModalContent, { backgroundColor: colors.card }]}>
								<View style={styles.advancePaymentHeader}>
									<LinearGradient
										colors={[colors.warning, colors.orange]}
										style={styles.advancePaymentIconCircle}
									>
										<Ionicons name="cash-outline" size={32} color="#fff" />
									</LinearGradient>
									<Text style={[styles.advancePaymentTitle, { color: colors.text }]}>
										Cash on Delivery
									</Text>
								</View>
								
								{currentShopId && (
									<>
										{shopSections.filter(shop => shop.shopId === currentShopId).map(shop => (
											<View key={shop.shopId}>
												<Text style={[styles.shopOrderTitle, { color: colors.primary }]}>
													Order from: {shop.shopName}
												</Text>
												
												<Text style={[styles.advancePaymentSubtitle, { color: colors.textLight }]}>
													To confirm your cash on delivery order, you need to pay an advance amount online.
												</Text>

												<View style={[styles.paymentBreakdown, { backgroundColor: `${colors.primary}05` }]}>
													<View style={styles.breakdownRow}>
														<Text style={[styles.breakdownLabel, { color: colors.textLight }]}>
															Total Order Amount:
														</Text>
														<Text style={[styles.breakdownAmount, { color: colors.text }]}>
															৳{shop.total.toFixed(2)}
														</Text>
													</View>
													
													{/* Calculate shop-specific advance payment */}
													{(() => {
														const shopAdvance = calculateShopAdvancePayment(shop.total, paymentMethod);
														return (
															<>
																<View style={styles.breakdownRow}>
																	<Text style={[styles.breakdownLabel, { color: colors.textLight }]}>
																		Advance Payment (10%):
																	</Text>
																	<Text style={[styles.breakdownAmountHighlight, { color: colors.warning }]}>
																		৳{shopAdvance.toFixed(2)}
																	</Text>
																</View>
																<View style={styles.breakdownRow}>
																	<Text style={[styles.breakdownLabel, { color: colors.textLight }]}>
																		Cash on Delivery:
																	</Text>
																	<Text style={[styles.breakdownAmount, { color: colors.text }]}>
																		৳{(shop.total - shopAdvance).toFixed(2)}
																	</Text>
																</View>
															</>
														);
													})()}
												</View>

												<View style={[styles.advancePaymentInfo, { backgroundColor: `${colors.info}15` }]}>
													<Ionicons name="information-circle-outline" size={20} color={colors.info} />
													<Text style={[styles.advancePaymentInfoText, { color: colors.info }]}>
														You'll pay the advance now via SSL Commerz and the remaining amount will be collected upon delivery.
													</Text>
												</View>
											</View>
										))}
									</>
								)}

								<View style={styles.floatingButtonContainer}>
									<TouchableOpacity
										style={styles.payAdvanceButton}
										onPress={() => proceedWithOrder(true)}
										disabled={placingOrder || processingPayment}
									>
										<LinearGradient
											colors={[colors.warning, colors.orange]}
											start={{ x: 0, y: 0 }}
											end={{ x: 1, y: 0 }}
											style={styles.payAdvanceButtonGradient}
										>
											{placingOrder || processingPayment ? (
												<ActivityIndicator color='#fff' />
											) : (
												<>
													<Ionicons name="card-outline" size={20} color="#fff" />
													{currentShopId && shopSections.filter(shop => shop.shopId === currentShopId).map(shop => {
														const shopAdvance = calculateShopAdvancePayment(shop.total, paymentMethod);
														return (
															<Text key={shop.shopId} style={styles.payAdvanceButtonText}>
																Pay Advance ৳{shopAdvance.toFixed(2)}
															</Text>
														);
													})}
												</>
											)}
										</LinearGradient>
									</TouchableOpacity>

									<TouchableOpacity
										style={[styles.cancelAdvanceButton, { 
											borderColor: colors.border,
											backgroundColor: colors.cardAlt 
										}]}
										onPress={() => {
											setShowAdvancePaymentModal(false);
											setCurrentShopId(null);
										}}
										disabled={placingOrder || processingPayment}
									>
										<Text style={[styles.cancelAdvanceButtonText, { color: colors.textLight }]}>
											Cancel
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						</View>
					</Modal>
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f9fbf7',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		fontWeight: '500',
	},
	headerContainer: {
		marginBottom: 16,
	},
	headerGradient: {
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
		overflow: 'hidden',
		height: 120,
	},
	headerContent: {
		padding: 24,
		height: '100%',
		justifyContent: 'center',
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#fff',
		marginBottom: 4,
	},
	headerSubtitle: {
		fontSize: 16,
		color: 'rgba(255, 255, 255, 0.8)',
		fontWeight: '500',
	},
	// Shop header styles
	shopHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 12,
		marginTop: 16,
		marginBottom: 8,
		marginHorizontal: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	shopHeaderLeft: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	shopHeaderName: {
		fontSize: 16,
		fontWeight: '600',
		marginLeft: 8,
	},
	placeOrderButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
	},
	placeOrderButtonText: {
		color: '#fff',
		fontWeight: '600',
		fontSize: 14,
	},
	// Shop footer styles
	shopFooter: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0,0,0,0.05)',
	},
	shopTotal: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
		marginTop: 8,
	},
	shopTotalAmount: {
		fontSize: 16,
		fontWeight: '600',
	},
	stockSummaryContainer: {
		marginTop: 12,
		paddingHorizontal: 10,
		paddingVertical: 12,
		backgroundColor: 'rgba(0,0,0,0.02)',
		borderRadius: 8,
	},
	stockWarning: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 6,
		borderWidth: 1,
		marginBottom: 10,
	},
	stockSummaryTitle: {
		fontSize: 14,
		fontWeight: '500',
		marginBottom: 8,
	},
	stockSummaryItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 4,
	},
	stockItemName: {
		fontSize: 13,
		flex: 1,
		marginRight: 8,
	},
	// Cart footer
	cartFooter: {
		padding: 16,
		marginTop: 16,
	},
	cartFooterSpacer: {
		height: 80,
	},
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 0, // No extra bottom padding since we'll have fixed buttons
		maxHeight: '90%',
		marginBottom: 36,
		display: 'flex',
		flexDirection: 'column',
	},
	modalButtonContainer: {
		flexDirection: 'row',
		paddingVertical: 16,
		paddingHorizontal: 20,
		borderTopWidth: 1,
		borderTopColor: 'rgba(0, 0, 0, 0.05)',
		backgroundColor: '#fff',
		marginTop: 10,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	modalTitle: {
		fontSize: 22,
		fontWeight: 'bold',
	},
	modalCloseBtn: {
		padding: 8,
	},
	sectionLabel: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 8,
		marginTop: 16,
	},
	locationSection: {
		marginBottom: 16,
	},
	locationButton: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderWidth: 1,
		borderRadius: 12,
		marginBottom: 8,
	},
	locationButtonText: {
		marginLeft: 8,
		fontWeight: '500',
	},
	selectedLocationContainer: {
		padding: 12,
		borderRadius: 12,
		marginTop: 8,
	},
	selectedLocationName: {
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	selectedLocationAddress: {
		fontSize: 14,
		lineHeight: 20,
	},
	coordinatesContainer: {
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: 'rgba(0, 0, 0, 0.1)',
	},
	coordinatesTitle: {
		fontSize: 12,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	coordinatesText: {
		fontSize: 11,
		marginLeft: 8,
	},
	input: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		fontSize: 16,
		minHeight: 100,
		textAlignVertical: 'top',
	},
	pickerContainer: {
		borderWidth: 1,
		borderRadius: 12,
		marginBottom: 16,
		overflow: 'hidden',
	},
	picker: {
		height: 60,
	},
	paymentInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderRadius: 12,
		marginBottom: 16,
	},
	paymentInfoText: {
		marginLeft: 8,
		fontSize: 14,
		flex: 1,
		lineHeight: 20,
	},
	codAdvanceInfo: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		padding: 12,
		borderRadius: 12,
		marginBottom: 16,
		borderWidth: 1,
	},
	codAdvanceInfoText: {
		marginLeft: 8,
		fontSize: 14,
		flex: 1,
		lineHeight: 20,
	},
	modalButtonsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 32,
		marginBottom: 20,
		paddingTop: 12,
		paddingHorizontal: 4,
	},
	floatingButtonContainer: {
		flexDirection: 'row',
		position: 'absolute',
		bottom: 40,
		left: 20,
		right: 20,
		paddingVertical: 16,
		backgroundColor: 'rgba(255, 255, 255, 0.95)',
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.15,
		shadowRadius: 10,
		elevation: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.05)',
		zIndex: 999,
	},
	closeButton: {
		padding: 16,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
		marginRight: 12,
		marginBottom: 0, // Removed bottom margin since we're using the floating container
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 4,
		elevation: 4,
		height: 56, // Fixed height for consistency
	},
	closeButtonText: {
		fontWeight: '700',
		fontSize: 16,
	},
	saveButton: {
		padding: 16,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		flex: 2,
		marginBottom: 0, // Removed bottom margin since we're using the floating container
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.2,
		shadowRadius: 5,
		elevation: 6,
		height: 56, // Fixed height for consistency
	},
	saveButtonText: {
		color: '#fff',
		fontWeight: '700', // Increased font weight
		fontSize: 17, // Increased font size
		textShadowColor: 'rgba(0,0,0,0.1)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2, // Added text shadow for better contrast
	},
	advancePaymentModalContent: {
		borderRadius: 24,
		padding: 24,
		paddingBottom: 120, // Increased to accommodate floating buttons
		margin: 16,
		marginBottom: 56,
		maxHeight: '80%',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 10,
		position: 'relative', // Added for proper positioning of floating buttons
	},
	advancePaymentHeader: {
		alignItems: 'center',
		marginBottom: 20,
	},
	advancePaymentIconCircle: {
		width: 64,
		height: 64,
		borderRadius: 32,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 12,
	},
	advancePaymentTitle: {
		fontSize: 22,
		fontWeight: 'bold',
	},
	advancePaymentSubtitle: {
		fontSize: 16,
		textAlign: 'center',
		lineHeight: 24,
		marginBottom: 24,
	},
	paymentBreakdown: {
		borderRadius: 16,
		padding: 18, // Increased padding
		marginBottom: 22, // Increased bottom margin
	},
	breakdownRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	breakdownLabel: {
		fontSize: 14,
		flex: 1,
	},
	breakdownAmount: {
		fontSize: 14,
		fontWeight: '600',
	},
	breakdownAmountHighlight: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	advancePaymentInfo: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		padding: 18, // Increased padding
		borderRadius: 12,
		marginBottom: 28, // Increased bottom margin
	},
	advancePaymentInfoText: {
		marginLeft: 12,
		fontSize: 14,
		flex: 1,
		lineHeight: 20,
	},
	advancePaymentButtons: {
		gap: 16, // Increased gap between buttons
		marginTop: 8, // Added top margin for better spacing
	},
	payAdvanceButton: {
		width: '70%',
	},
	payAdvanceButtonGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 18, // Increased padding
		borderRadius: 12,
	},
	payAdvanceButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
		marginLeft: 8,
	},
	cancelAdvanceButton: {
		borderWidth: 1,
		padding: 18, // Increased padding
		borderRadius: 12,
		alignItems: 'center',
	},
	cancelAdvanceButtonText: {
		fontSize: 16,
		fontWeight: '500',
	},
	cartCard: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 16,
		marginVertical: 8,
		borderRadius: 14,
		padding: 12,
		elevation: 1,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 2,
	},
	itemImageWrapper: {
		width: 60,
		height: 60,
		borderRadius: 10,
		overflow: 'hidden',
		marginRight: 14,
		backgroundColor: '#f2f2f2',
	},
	itemImage: {
		width: '100%',
		height: '100%',
		borderRadius: 10,
		resizeMode: 'cover',
	},
	itemContent: {
		flex: 1,
		justifyContent: 'space-between',
	},
	itemInfo: {
		marginBottom: 8,
	},
	itemName: {
		fontSize: 16,
		fontWeight: '600',
	},
	itemPrice: {
		fontSize: 15,
		fontWeight: '500',
		marginTop: 2,
	},
	priceStockRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 4,
	},
	stockBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1,
	},
	stockIcon: {
		marginRight: 4,
	},
	stockInfo: {
		fontSize: 12,
		fontStyle: 'italic',
	},
	itemActions: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
	},
	quantityContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 2,
		marginRight: 10,
	},
	quantityButton: {
		padding: 4,
		borderRadius: 6,
	},
	quantityButtonDisabled: {
		opacity: 0.4,
		backgroundColor: 'rgba(0,0,0,0.05)',
	},
	quantity: {
		fontSize: 15,
		fontWeight: '500',
		marginHorizontal: 8,
	},
	removeButton: {
		marginLeft: 8,
		padding: 4,
		borderRadius: 6,
		backgroundColor: '#fff0f0',
	},
	totalContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 14,
		borderRadius: 10,
		marginBottom: 10,
		borderWidth: 1,
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: '500',
	},
	totalAmount: {
		fontSize: 18,
		fontWeight: '700',
	},
	advanceContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 10,
		borderRadius: 8,
		marginBottom: 10,
		borderWidth: 1,
	},
	advanceLabel: {
		fontSize: 15,
		fontWeight: '500',
	},
	advanceAmount: {
		fontSize: 16,
		fontWeight: '700',
	},
	actionButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 10,
	},
	clearButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginRight: 10,
	},
	clearButtonText: {
		fontWeight: '600',
		fontSize: 14,
		marginLeft: 4,
	},
	toggleButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 8,
		marginRight: 10,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	toggleButtonGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	toggleButtonText: {
		color: '#fff',
		fontWeight: '600',
		fontSize: 14,
		marginLeft: 6,
		height: 30, // Ensuring text fits well within the button
	},
	selectPaymentButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	selectPaymentGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	selectPaymentText: {
		color: '#fff',
		fontWeight: '600',
		fontSize: 14,
		marginLeft: 6,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 40,
	},
	emptyGradient: {
		width: 120,
		height: 120,
		borderRadius: 60,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 24,
	},
	emptyText: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 8,
		textAlign: 'center',
	},
	emptySubtext: {
		fontSize: 16,
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 22,
		paddingHorizontal: 20,
	},
	shopNowButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 12,
	},
	shopNowButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	shopOrderTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginVertical: 12,
		textAlign: 'center',
	},
});