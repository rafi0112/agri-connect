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

	const initiateOnlinePayment = async (orderId: string, isAdvancePayment: boolean = false) => {
		if (!user) return false;

		try {
			setProcessingPayment(true);
			
			// Use orderId as transaction ID for easier tracking
			const transactionId = orderId;
			const customerName = user.name || user.email.split('@')[0];
			const address = selectedLocation?.address || deliveryAddress || 'Dhaka, Bangladesh';
			
			// Calculate payment amount based on payment type
			const paymentAmount = isAdvancePayment ? advancePaymentAmount : total;
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
				totalAmount: total,
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

	const handlePlaceOrder = async () => {
		if (!user) {
			Toast.show({
				type: 'error',
				text1: 'Error',
				text2: 'User is not logged in.',
			});
			return;
		}

		if (cartItems.length === 0) {
			Toast.show({
				type: 'error',
				text1: 'Order Failed',
				text2: 'Your cart is empty',
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

		// For Cash on Delivery, show advance payment modal
		if (paymentMethod === 'cash_on_delivery') {
			setShowAdvancePaymentModal(true);
			return;
		}

		// For online payment, proceed normally
		await proceedWithOrder();
	};

	const proceedWithOrder = async (isAdvancePayment: boolean = false) => {
		if (!user) return;

		setPlacingOrder(true);
		try {
			// Generate a unique order ID that we'll use as transaction ID for online payments
			const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
			
			// Create order document with shop information
			const orderData: any = {
				userId: user.id,
				userEmail: user.email,
				items: cartItems.map((item) => ({
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
				total: total,
				status: 'pending',
				createdAt: new Date(),
				deliveryAddress: selectedLocation?.address || deliveryAddress,
				deliveryLocation: selectedLocation,
				paymentMethod: paymentMethod,
				paymentStatus: paymentMethod === 'online_payment' ? 'pending' : 
							   (isAdvancePayment ? 'advance_paid' : 'cash_on_delivery'),
				advancePaymentAmount: isAdvancePayment ? advancePaymentAmount : 0,
				remainingAmount: isAdvancePayment ? (total - advancePaymentAmount) : 0,
			};

			// Add location in the requested format if available
			if (selectedLocation) {
				orderData['delivery location(map)'] = formatLocationForStorage(selectedLocation);
				console.log('Order delivery location (map):', orderData['delivery location(map)']);
			}

			// Create order with specific ID for online payments
			const orderRef = doc(db, 'orders', orderId);
			await setDoc(orderRef, orderData);

			// Handle payment based on method
			if (paymentMethod === 'online_payment') {
				const paymentSuccess = await initiateOnlinePayment(orderId);
				if (!paymentSuccess) {
					// If payment fails, we keep the order but mark it as payment failed
					await setDoc(orderRef, { paymentStatus: 'failed' }, { merge: true });
					return;
				}
			} else if (paymentMethod === 'cash_on_delivery' && isAdvancePayment) {
				// Handle advance payment for COD
				const paymentSuccess = await initiateOnlinePayment(orderId, true);
				if (!paymentSuccess) {
					// If advance payment fails, we keep the order but mark it as payment failed
					await setDoc(orderRef, { paymentStatus: 'failed' }, { merge: true });
					return;
				}
			}

			// Clear the user's cart after successful order
			const cartRef = doc(db, 'carts', user.id);
			await setDoc(cartRef, { items: [] });

			const orderMessage = isAdvancePayment 
				? `Order #${orderId} placed! Advance payment of ৳${advancePaymentAmount.toFixed(2)} processed. Remaining ৳${(total - advancePaymentAmount).toFixed(2)} will be collected on delivery.`
				: `Order #${orderId} placed successfully!`;

			Toast.show({
				type: 'success',
				text1: 'Order Successful',
				text2: orderMessage,
			});
			clearCart();
			setShowAdvancePaymentModal(false);

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
				
					<FlatList
						data={cartItems}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<View style={[styles.cartCard, { backgroundColor: colors.card }]}>
								<View style={styles.itemImageWrapper}>
									<Image 
										source={{ uri: item.image || 'https://via.placeholder.com/150' }}
										style={styles.itemImage}
									/>
								</View>
								<View style={styles.itemContent}>
									<View style={styles.itemInfo}>
										<Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
										<Text style={[styles.itemPrice, { color: colors.primary }]}>
											৳{item.price.toFixed(2)}/{item.unit}
										</Text>
										{item.shopName && (
											<View style={styles.shopInfoRow}>
												<Ionicons name="storefront-outline" size={14} color={colors.textLight} />
												<Text style={[styles.shopName, { color: colors.textLight }]}>
													{item.shopName}
												</Text>
											</View>
										)}
									</View>
									<View style={styles.itemActions}>
										<View style={[styles.quantityContainer, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
											<TouchableOpacity
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
											</TouchableOpacity>
											<Text style={[styles.quantity, { color: colors.text }]}>{item.quantity}</Text>
											<TouchableOpacity
												onPress={() => {
													// Check product stock before increasing quantity
													const checkStock = async () => {
														try {
															const productRef = doc(db, 'products', item.id);
															const productSnap = await getDoc(productRef);
															
															if (productSnap.exists()) {
																const productData = productSnap.data();
																const stock = productData.stock || 0;
																
																if (item.quantity < stock) {
																	updateQuantity(item.id, item.quantity + 1);
																} else {
																	Toast.show({
																		type: 'error',
																		text1: 'Stock Limit Reached',
																		text2: `Only ${stock} units available`,
																	});
																}
															}
														} catch (error) {
															console.error('Error checking stock:', error);
															Toast.show({
																type: 'error',
																text1: 'Error',
																text2: 'Could not update quantity',
															});
														}
													};
												
													checkStock();
												}}
												style={styles.quantityButton}
											>
												<Ionicons
													name='add'
													size={18}
													color={colors.primary}
												/>
											</TouchableOpacity>
										</View>
										<TouchableOpacity
											style={[styles.removeButton, { backgroundColor: `${colors.error}15` }]
											}
											onPress={() => removeFromCart(item.id)}
										>
											<Ionicons name='trash-outline' size={18} color={colors.error} />
										</TouchableOpacity>
									</View>
								</View>
							</View>
						)}
						contentContainerStyle={styles.cartList}
					/>

					<View style={[styles.orderSummaryCard, { backgroundColor: colors.card }]}>
						<View style={styles.summaryRow}>
							<Text style={[styles.summaryLabel, { color: colors.textLight }]}>Subtotal:</Text>
							<Text style={[styles.summaryValue, { color: colors.text }]}>৳{total.toFixed(2)}</Text>
						</View>
						<View style={styles.summaryRow}>
							<Text style={[styles.summaryLabel, { color: colors.textLight }]}>Delivery Fee:</Text>
							<Text style={[styles.summaryValue, { color: colors.text }]}>৳0.00</Text>
						</View>
						<View style={styles.divider} />
						<View style={styles.summaryRow}>
							<Text style={[styles.totalLabel, { color: colors.text }]}>Total:</Text>
							<Text style={[styles.totalValue, { color: colors.primary }]}>৳{total.toFixed(2)}</Text>
						</View>

						{/* Show advance payment breakdown for COD */}
						{paymentMethod === 'cash_on_delivery' && (
							<View style={[styles.advanceSummary, { 
								backgroundColor: `${colors.warning}10`,
								borderColor: `${colors.warning}30`,
							}]}
							>
								<Text style={[styles.advanceSummaryTitle, { color: colors.warning }]}>
									Payment Breakdown:
								</Text>
								<View style={styles.advanceBreakdownRow}>
									<Text style={[styles.advanceLabel, { color: colors.warning }]}>
										Online Advance (10%):
									</Text>
									<Text style={[styles.advanceAmount, { color: colors.warning }]}>
										৳{advancePaymentAmount.toFixed(2)}
									</Text>
								</View>
								<View style={styles.advanceBreakdownRow}>
									<Text style={[styles.advanceLabel, { color: colors.warning }]}>
										Cash on Delivery:
									</Text>
									<Text style={[styles.advanceAmount, { color: colors.warning }]}>
										৳{(total - advancePaymentAmount).toFixed(2)}
									</Text>
								</View>
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

							{paymentMethod ? (
								<TouchableOpacity
									style={styles.orderButton}
									onPress={handlePlaceOrder}
									disabled={placingOrder || processingPayment}
								>
									<LinearGradient
										colors={paymentMethod === 'cash_on_delivery' ? 
											[colors.warning, colors.orange] : 
											[colors.primary, colors.primaryLight]
										}
										start={{ x: 0, y: 0 }}
										end={{ x: 1, y: 0 }}
										style={styles.orderButtonGradient}
									>
										{placingOrder || processingPayment ? (
											<ActivityIndicator color='#fff' size="small" />
										) : (
											<>
												<Ionicons
													name={paymentMethod === 'cash_on_delivery' ? 'cash-outline' : 'card-outline'}
													size={20}
													color='#fff'
												/>
												<Text style={styles.orderButtonText}>
													{paymentMethod === 'cash_on_delivery' ? 'Place COD Order' : 'Click to \nPay Now'}
												</Text>
											</>
										)}
									</LinearGradient>
								</TouchableOpacity>
							) : (
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
										<Text style={styles.selectPaymentText}>Select Payment</Text>
									</LinearGradient>
								</TouchableOpacity>
							)}
						</View>
					</View>

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
								
								<Text style={[styles.advancePaymentSubtitle, { color: colors.textLight }]}
								>
									To confirm your cash on delivery order, you need to pay an advance amount online.
								</Text>

								<View style={[styles.paymentBreakdown, { backgroundColor: `${colors.primary}05` }]}
								>
									<View style={styles.breakdownRow}>
										<Text style={[styles.breakdownLabel, { color: colors.textLight }]}
										>
											Total Order Amount:
										</Text>
										<Text style={[styles.breakdownAmount, { color: colors.text }]}
										>
											৳{total.toFixed(2)}
										</Text>
									</View>
									<View style={styles.breakdownRow}>
										<Text style={[styles.breakdownLabel, { color: colors.textLight }]}
										>
											Advance Payment (10%):
										</Text>
										<Text style={[styles.breakdownAmountHighlight, { color: colors.warning }]}
										>
											৳{advancePaymentAmount.toFixed(2)}
										</Text>
									</View>
									<View style={styles.breakdownRow}>
										<Text style={[styles.breakdownLabel, { color: colors.textLight }]}
										>
											Cash on Delivery:
										</Text>
										<Text style={[styles.breakdownAmount, { color: colors.text }]}
										>
											৳{(total - advancePaymentAmount).toFixed(2)}
										</Text>
									</View>
								</View>

								<View style={[styles.advancePaymentInfo, { backgroundColor: `${colors.info}15` }]}
								>
									<Ionicons name="information-circle-outline" size={20} color={colors.info} />
									<Text style={[styles.advancePaymentInfoText, { color: colors.info }]}
									>
										You'll pay ৳{advancePaymentAmount.toFixed(2)} now via SSL Commerz and the remaining ৳{(total - advancePaymentAmount).toFixed(2)} will be collected upon delivery.
									</Text>
								</View>

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
													<Text style={styles.payAdvanceButtonText}>
														Pay Advance ৳{advancePaymentAmount.toFixed(2)}
													</Text>
												</>
											)}
										</LinearGradient>
									</TouchableOpacity>

									<TouchableOpacity
										style={[styles.cancelAdvanceButton, { 
											borderColor: colors.border,
											backgroundColor: colors.cardAlt 
										}]}
										onPress={() => setShowAdvancePaymentModal(false)}
										disabled={placingOrder || processingPayment}
									>
										<Text style={[styles.cancelAdvanceButtonText, { color: colors.textLight }]}
										>
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
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 40,
		marginTop: -40,
	},
	emptyGradient: {
		width: 160,
		height: 160,
		borderRadius: 80,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 24,
	},
	emptyText: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 12,
	},
	emptySubtext: {
		fontSize: 16,
		textAlign: 'center',
		marginBottom: 24,
		paddingHorizontal: 20,
		lineHeight: 22,
	},
	shopNowButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 12,
		marginTop: 16,
	},
	shopNowButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold',
	},
	cartList: {
		padding: 16,
		paddingBottom: 280, // Increased space for the fixed bottom panel and tab bar
	},
	cartCard: {
		flexDirection: 'row',
		borderRadius: 16,
		marginBottom: 16,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 3,
	},
	itemImageWrapper: {
		width: 100,
		height: 100,
		backgroundColor: '#f5f7f3',
	},
	itemImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
	},
	itemContent: {
		flex: 1,
		padding: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	itemInfo: {
		flex: 1,
		marginRight: 8,
	},
	itemName: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 4,
	},
	itemPrice: {
		fontSize: 15,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	shopInfoRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	shopName: {
		fontSize: 12,
		marginLeft: 4,
	},
	itemActions: {
		justifyContent: 'space-between',
	},
	quantityContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 8,
	},
	quantityButton: {
		padding: 6,
		borderRadius: 8,
	},
	quantityButtonDisabled: {
		opacity: 0.5,
	},
	quantity: {
		fontSize: 14,
		fontWeight: '600',
		paddingHorizontal: 8,
	},
	removeButton: {
		padding: 8,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	orderSummaryCard: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 20,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 10,
		paddingBottom: 36,
	},
	summaryRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	summaryLabel: {
		fontSize: 14,
	},
	summaryValue: {
		fontSize: 14,
		fontWeight: '500',
	},
	divider: {
		height: 1,
		backgroundColor: '#eaefea',
		marginVertical: 12,
	},
	totalLabel: {
		fontSize: 18,
		fontWeight: 'bold',
	},
	totalValue: {
		fontSize: 20,
		fontWeight: 'bold',
	},
	advanceSummary: {
		padding: 12,
		borderRadius: 12,
		marginTop: 12,
		marginBottom: 16,
		borderWidth: 1,
	},
	advanceSummaryTitle: {
		fontWeight: '600',
		marginBottom: 8,
		fontSize: 14,
	},
	advanceBreakdownRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	advanceLabel: {
		fontSize: 13,
	},
	advanceAmount: {
		fontSize: 13,
		fontWeight: '600',
	},
	actionButtons: {
		flexDirection: 'row',
		marginTop: 16,
		marginBottom: 94,
	},
	clearButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderRadius: 12,
		marginRight: 8,
	},
	clearButtonText: {
		fontSize: 14,
		fontWeight: '600',
		marginLeft: 4,
	},
	toggleButton: {
		flex: 1,
		marginRight: 8,
	},
	toggleButtonGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 12,
	},
	toggleButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		marginLeft: 8,
	},
	orderButton: {
		flex: 1.5,
	},
	orderButtonGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 12,
	},
	orderButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		marginLeft: 8,
	},
	selectPaymentButton: {
		flex: 1.5,
	},
	selectPaymentGradient: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 12,
	},
	selectPaymentText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		marginLeft: 8,
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
});