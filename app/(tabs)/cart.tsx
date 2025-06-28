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
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import LocationSelector, { LocationData } from '../../components/LocationSelector';
import { initiateSSLCommerzPayment, generateTransactionId, PaymentData } from '../../utils/sslcommerz';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#4CAF50' />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{cartItems.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Ionicons name='cart-outline' size={50} color='#ccc' />
					<Text style={styles.emptyText}>Your cart is empty</Text>
				</View>
			) : (
				<>
					<FlatList
						data={cartItems}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<View style={styles.item}>
								<View style={styles.itemInfo}>
									<Text style={styles.itemName}>{item.name}</Text>
									<Text style={styles.itemPrice}>
										৳{item.price.toFixed(2)}/{item.unit}
									</Text>
									{item.shopName && (
										<>
											<Text style={styles.shopName}>Shop: {item.shopName}</Text>
											
										</>
									)}
								</View>
								<View style={styles.itemActions}>
									<View style={styles.quantityContainer}>
										<TouchableOpacity
											onPress={() => updateQuantity(item.id, item.quantity - 1)}
											disabled={item.quantity <= 1}
										>
											<Ionicons
												name='remove-circle-outline'
												size={36}
												color={item.quantity <= 1 ? '#ccc' : '#2e86de'}
											/>
										</TouchableOpacity>
										<Text style={styles.quantity}>{item.quantity}</Text>
										<TouchableOpacity
											onPress={() => updateQuantity(item.id, item.quantity + 1)}
										>
											<Ionicons
												name='add-circle-outline'
												size={36}
												color='#2e86de'
											/>
										</TouchableOpacity>
									</View>
									<TouchableOpacity
										style={styles.removeButton}
										onPress={() => removeFromCart(item.id)}
									>
										<Ionicons name='trash-outline' size={24} color='#fff' />
									</TouchableOpacity>
								</View>
							</View>
						)}
						contentContainerStyle={styles.listContent}
					/>

					<TouchableOpacity style={styles.toggleButton} onPress={toggleModal}>
						<Text style={styles.toggleButtonText}>Set Delivery Details</Text>
					</TouchableOpacity>

					<Modal
						visible={isModalVisible}
						animationType='slide'
						transparent={true}
						onRequestClose={toggleModal}
					>
						<View style={styles.modalContainer}>
							<View style={styles.modalContent}>
								<Text style={styles.modalTitle}>Delivery Details</Text>
								
								{/* Location Selection */}
								<View style={styles.locationSection}>
									<Text style={styles.label}>Delivery Location:</Text>
									<TouchableOpacity
										style={styles.locationButton}
										onPress={() => setIsLocationSelectorVisible(true)}
									>
										<Ionicons name="location-outline" size={20} color="#4CAF50" />
										<Text style={styles.locationButtonText}>
											{selectedLocation ? 'Change Location' : 'Select Location on Map'}
										</Text>
									</TouchableOpacity>
									
									{selectedLocation && (
										<View style={styles.selectedLocationContainer}>
											<Text style={styles.selectedLocationName}>
												{selectedLocation.name || 'Selected Location'}
											</Text>
											<Text style={styles.selectedLocationAddress}>
												{selectedLocation.address}
											</Text>
											<View style={styles.coordinatesContainer}>
												<Text style={styles.coordinatesTitle}>Coordinates:</Text>
												<Text style={styles.coordinatesText}>
													latitude: {selectedLocation.latitude.toString()}
												</Text>
												<Text style={styles.coordinatesText}>
													longitude: {selectedLocation.longitude.toString()}
												</Text>
											</View>
										</View>
									)}
								</View>

								{/* Manual Address Input */}
								<Text style={styles.label}>Delivery Address:</Text>
								<TextInput
									style={styles.input}
									value={deliveryAddress}
									onChangeText={setDeliveryAddress}
									placeholder='Enter your delivery address'
									multiline
								/>

								{/* Payment Method */}
								<Text style={styles.label}>Payment Method:</Text>
								<Picker
									selectedValue={paymentMethod}
									onValueChange={(itemValue) => setPaymentMethod(itemValue)}
									style={styles.picker}
								>
									<Picker.Item label="Select Payment Method" value="" />
									<Picker.Item
										label='Cash on Delivery (10% advance required)'
										value='cash_on_delivery'
									/>
									<Picker.Item label='Online Payment (SSL Commerz)' value='online_payment' />
								</Picker>

								{/* Payment Info */}
								{paymentMethod === 'online_payment' && (
									<View style={styles.paymentInfo}>
										<Ionicons name="card-outline" size={20} color="#2196F3" />
										<Text style={styles.paymentInfoText}>
											You will be redirected to SSL Commerz for secure payment
										</Text>
									</View>
								)}

								{/* COD Advance Payment Info */}
								{paymentMethod === 'cash_on_delivery' && (
									<View style={styles.codAdvanceInfo}>
										<Ionicons name="cash-outline" size={20} color="#FF9800" />
										<Text style={styles.codAdvanceInfoText}>
											Cash on Delivery requires 10% advance payment (৳{advancePaymentAmount.toFixed(2)}) online. 
											Remaining ৳{(total - advancePaymentAmount).toFixed(2)} will be collected on delivery.
										</Text>
									</View>
								)}

								<TouchableOpacity
									style={styles.saveButton}
									onPress={handleSetDetails}
								>
									<Text style={styles.saveButtonText}>Save Details</Text>
								</TouchableOpacity>

								<TouchableOpacity
									style={styles.closeButton}
									onPress={toggleModal}
								>
									<Text style={styles.closeButtonText}>Close</Text>
								</TouchableOpacity>
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

					<View style={styles.summaryContainer}>
						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>Total:</Text>
							<Text style={styles.totalAmount}>৳{total.toFixed(2)}</Text>
						</View>

						{/* Show advance payment breakdown for COD */}
						{paymentMethod === 'cash_on_delivery' && (
							<View style={styles.advanceSummary}>
								<Text style={styles.advanceSummaryTitle}>Payment Breakdown:</Text>
								<View style={styles.advanceBreakdownRow}>
									<Text style={styles.advanceLabel}>Online Advance (10%):</Text>
									<Text style={styles.advanceAmount}>৳{advancePaymentAmount.toFixed(2)}</Text>
								</View>
								<View style={styles.advanceBreakdownRow}>
									<Text style={styles.advanceLabel}>Cash on Delivery:</Text>
									<Text style={styles.advanceAmount}>৳{(total - advancePaymentAmount).toFixed(2)}</Text>
								</View>
							</View>
						)}

						<View style={styles.buttonContainer}>
							<TouchableOpacity
								style={[styles.button, styles.clearButton]}
								onPress={clearCart}
							>
								<Text style={styles.clearButtonText}>Clear Cart</Text>
							</TouchableOpacity>

							{paymentMethod === 'online_payment' ? (
								<TouchableOpacity
									style={[styles.button, styles.payOnlineButton]}
									onPress={handlePlaceOrder}
									disabled={placingOrder || processingPayment}
								>
									{placingOrder || processingPayment ? (
										<ActivityIndicator color='#fff' />
									) : (
										<>
											<Ionicons
												name='card-outline'
												size={20}
												color='#fff'
											/>
											<Text style={styles.buttonText}>Pay Online</Text>
										</>
									)}
								</TouchableOpacity>
							) : (
								<TouchableOpacity
									style={[styles.button, paymentMethod === 'cash_on_delivery' ? styles.codButton : styles.orderButton]}
									onPress={handlePlaceOrder}
									disabled={placingOrder}
								>
									{placingOrder ? (
										<ActivityIndicator color='#fff' />
									) : (
										<>
											<Ionicons
												name={paymentMethod === 'cash_on_delivery' ? 'cash-outline' : 'checkmark-circle-outline'}
												size={20}
												color='#fff'
											/>
											<Text style={styles.buttonText}>
												{paymentMethod === 'cash_on_delivery' ? 'Place COD Order' : 'Place Order'}
											</Text>
										</>
									)}
								</TouchableOpacity>
							)}
						</View>
					</View>
				</>
			)}

			{/* Advance Payment Modal for COD */}
			<Modal
				visible={showAdvancePaymentModal}
				animationType='slide'
				transparent={true}
				onRequestClose={() => setShowAdvancePaymentModal(false)}
			>
				<View style={styles.modalContainer}>
					<View style={styles.advancePaymentModalContent}>
						<View style={styles.advancePaymentHeader}>
							<Ionicons name="cash-outline" size={32} color="#FF9800" />
							<Text style={styles.advancePaymentTitle}>Cash on Delivery</Text>
						</View>
						
						<Text style={styles.advancePaymentSubtitle}>
							To confirm your cash on delivery order, you need to pay an advance amount online.
						</Text>

						<View style={styles.paymentBreakdown}>
							<View style={styles.breakdownRow}>
								<Text style={styles.breakdownLabel}>Total Order Amount:</Text>
								<Text style={styles.breakdownAmount}>৳{total.toFixed(2)}</Text>
							</View>
							<View style={styles.breakdownRow}>
								<Text style={styles.breakdownLabel}>Advance Payment (10%):</Text>
								<Text style={styles.breakdownAmountHighlight}>৳{advancePaymentAmount.toFixed(2)}</Text>
							</View>
							<View style={styles.breakdownRow}>
								<Text style={styles.breakdownLabel}>Cash on Delivery:</Text>
								<Text style={styles.breakdownAmount}>৳{(total - advancePaymentAmount).toFixed(2)}</Text>
							</View>
						</View>

						<View style={styles.advancePaymentInfo}>
							<Ionicons name="information-circle-outline" size={20} color="#2196F3" />
							<Text style={styles.advancePaymentInfoText}>
								You'll pay ৳{advancePaymentAmount.toFixed(2)} now via SSL Commerz and the remaining ৳{(total - advancePaymentAmount).toFixed(2)} will be collected upon delivery.
							</Text>
						</View>

						<View style={styles.advancePaymentButtons}>
							<TouchableOpacity
								style={styles.payAdvanceButton}
								onPress={() => proceedWithOrder(true)}
								disabled={placingOrder || processingPayment}
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
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.cancelAdvanceButton}
								onPress={() => setShowAdvancePaymentModal(false)}
								disabled={placingOrder || processingPayment}
							>
								<Text style={styles.cancelAdvanceButtonText}>Cancel</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
		backgroundColor: '#f8f9fa',
		marginBottom: 90,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 18,
		color: '#666',
		marginTop: 16,
	},
	listContent: {
		paddingBottom: 16,
	},
	item: {
		backgroundColor: '#fff',
		borderRadius: 8,
		padding: 16,
		marginBottom: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	itemInfo: {
		flex: 1,
	},
	itemName: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 4,
	},
	itemPrice: {
		fontSize: 14,
		color: '#666',
		marginBottom: 4,
		fontWeight: 'bold',
	},
	shopName: {
		fontSize: 14,
		color: '#888',
		fontStyle: 'italic',
		fontWeight: '500',
	},
	itemActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	quantityContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 10,
	},
	quantity: {
		marginHorizontal: 12,
		fontSize: 18,
		fontWeight: '600',
	},
	removeButton: {
		backgroundColor: '#ff3b30',
		borderRadius: 20,
		width: 40,
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 15,
	},
	summaryContainer: {
		backgroundColor: '#fff',
		borderRadius: 8,
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	totalRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	totalLabel: {
		fontSize: 18,
		fontWeight: '500',
	},
	totalAmount: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#2e86de',
	},
	advanceSummary: {
		backgroundColor: '#fff3e0',
		borderRadius: 8,
		padding: 12,
		marginTop: 12,
		borderWidth: 1,
		borderColor: '#FFB74D',
	},
	advanceSummaryTitle: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#F57C00',
		marginBottom: 8,
	},
	advanceBreakdownRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	advanceLabel: {
		fontSize: 14,
		color: '#F57C00',
	},
	advanceAmount: {
		fontSize: 14,
		fontWeight: '600',
		color: '#F57C00',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	button: {
		flex: 1,
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
	},
	clearButton: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#ff3b30',
		marginRight: 8,
	},
	clearButtonText: {
		color: '#ff3b30',
		fontWeight: 'bold',
		marginLeft: 8,
	},
	orderButton: {
		backgroundColor: '#4CAF50',
		marginLeft: 8,
	},
	codButton: {
		backgroundColor: '#FF9800',
		marginLeft: 8,
	},
	buttonText: {
		color: '#fff',
		fontWeight: 'bold',
		marginLeft: 8,
	},
	detailsContainer: {
		marginVertical: 16,
		padding: 16,
		backgroundColor: '#fff',
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	label: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 8,
	},
	input: {
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
		fontSize: 16,
	},
	saveButton: {
		backgroundColor: '#4CAF50',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	saveButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	toggleButton: {
		backgroundColor: '#4CAF50',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginVertical: 16,
	},
	toggleButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		width: '90%',
		backgroundColor: '#fff',
		borderRadius: 8,
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	picker: {
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 8,
		marginBottom: 16,
	},
	closeButton: {
		backgroundColor: '#ff3b30',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 16,
	},
	closeButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20,
		textAlign: 'center',
		color: '#333',
	},
	locationSection: {
		marginBottom: 16,
	},
	locationButton: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderWidth: 1,
		borderColor: '#4CAF50',
		borderRadius: 8,
		backgroundColor: '#f8f9fa',
		marginBottom: 8,
	},
	locationButtonText: {
		marginLeft: 8,
		color: '#4CAF50',
		fontWeight: '500',
	},
	selectedLocationContainer: {
		backgroundColor: '#e8f5e8',
		padding: 12,
		borderRadius: 8,
		marginTop: 8,
	},
	selectedLocationName: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#333',
		marginBottom: 4,
	},
	selectedLocationAddress: {
		fontSize: 14,
		color: '#666',
		lineHeight: 20,
	},
	paymentInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#e3f2fd',
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
	},
	paymentInfoText: {
		marginLeft: 8,
		fontSize: 14,
		color: '#2196F3',
		flex: 1,
	},
	codAdvanceInfo: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: '#fff3e0',
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#FFB74D',
	},
	codAdvanceInfoText: {
		marginLeft: 8,
		fontSize: 14,
		color: '#F57C00',
		flex: 1,
		lineHeight: 20,
	},
	payOnlineButton: {
		backgroundColor: '#2196F3',
		marginLeft: 8,
	},
	coordinatesContainer: {
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: '#e0e0e0',
	},
	coordinatesTitle: {
		fontSize: 12,
		fontWeight: 'bold',
		color: '#4CAF50',
		marginBottom: 4,
	},
	coordinatesText: {
		fontSize: 11,
		color: '#666',
		marginLeft: 8,
	},
	// Advance Payment Modal Styles
	advancePaymentModalContent: {
		backgroundColor: '#fff',
		borderRadius: 20,
		padding: 24,
		margin: 20,
		maxHeight: '80%',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 10,
	},
	advancePaymentHeader: {
		alignItems: 'center',
		marginBottom: 20,
	},
	advancePaymentTitle: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#333',
		marginTop: 8,
	},
	advancePaymentSubtitle: {
		fontSize: 16,
		color: '#666',
		textAlign: 'center',
		lineHeight: 24,
		marginBottom: 24,
	},
	paymentBreakdown: {
		backgroundColor: '#f8f9fa',
		borderRadius: 12,
		padding: 16,
		marginBottom: 20,
	},
	breakdownRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	breakdownLabel: {
		fontSize: 14,
		color: '#666',
		flex: 1,
	},
	breakdownAmount: {
		fontSize: 14,
		fontWeight: '600',
		color: '#333',
	},
	breakdownAmountHighlight: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#FF9800',
	},
	advancePaymentInfo: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: '#e3f2fd',
		padding: 16,
		borderRadius: 12,
		marginBottom: 24,
	},
	advancePaymentInfoText: {
		marginLeft: 12,
		fontSize: 14,
		color: '#2196F3',
		flex: 1,
		lineHeight: 20,
	},
	advancePaymentButtons: {
		gap: 12,
	},
	payAdvanceButton: {
		backgroundColor: '#FF9800',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
		borderRadius: 12,
		gap: 8,
	},
	payAdvanceButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	cancelAdvanceButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: '#ddd',
		padding: 16,
		borderRadius: 12,
		alignItems: 'center',
	},
	cancelAdvanceButtonText: {
		color: '#666',
		fontSize: 16,
		fontWeight: '500',
	},
});