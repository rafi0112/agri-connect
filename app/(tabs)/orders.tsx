import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { collection, query, where, getDocs, getFirestore, orderBy, doc, getDoc } from 'firebase/firestore';
import { app } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  image: string;
  farmerId: string;
  shopId: string;
  shopName?: string;
};

type Order = {
  id: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'confirmed';
  paymentStatus?: 'pending' | 'success' | 'failed' | 'cancelled' | 'cash_on_delivery' | 'advance_paid';
  paymentMethod?: 'online_payment' | 'cash_on_delivery';
  advancePaymentAmount?: number;
  remainingAmount?: number;
  createdAt: Date;
  deliveryAddress: string;
  deliveryLocation?: any;
  userId: string;
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const db = getFirestore(app);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const fetchShopInfo = async (shopId: string | undefined) => {
    if (!shopId) {
      return {
        name: 'Unknown Shop',
        farmerId: 'unknown'
      };
    }

    try {
      const shopRef = doc(db, 'shops', shopId);
      const shopSnap = await getDoc(shopRef);
      if (shopSnap.exists()) {
        return {
          name: shopSnap.data().name || 'Unknown Shop',
          farmerId: shopSnap.data().farmerId || 'unknown'
        };
      }
      return {
        name: 'Unknown Shop',
        farmerId: 'unknown'
      };
    } catch (error) {
      console.error('Error fetching shop info:', error);
      return {
        name: 'Unknown Shop',
        farmerId: 'unknown'
      };
    }
  };

  const fetchOrders = async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      let q;
      let querySnapshot;
      let usedFallback = false;
      
      try {
        q = query(
          collection(db, 'orders'),
          where('userId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        querySnapshot = await getDocs(q);
      } catch (error) {
        if (error instanceof Error && 'code' in error && (error as any).code === 'failed-precondition') {
          console.warn('Using fallback query - index may not be ready');
          q = query(
            collection(db, 'orders'),
            where('userId', '==', user.id)
          );
          querySnapshot = await getDocs(q);
          usedFallback = true;
        } else {
          throw error;
        }
      }

      const ordersData: Order[] = [];
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        
        // Process items with shop info
        const itemsWithShopInfo = await Promise.all(
          data.items.map(async (item: any) => {
            const shopInfo = await fetchShopInfo(item.shopId);
            return {
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              unit: item.unit,
              image: item.image || 'https://via.placeholder.com/100',
              farmerId: shopInfo.farmerId,
              shopId: item.shopId || 'unknown',
              shopName: shopInfo.name
            };
          })
        );

        ordersData.push({
          id: doc.id,
          items: itemsWithShopInfo,
          total: data.total,
          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'pending',
          paymentMethod: data.paymentMethod || 'cash_on_delivery',
          advancePaymentAmount: data.advancePaymentAmount || 0,
          remainingAmount: data.remainingAmount || 0,
          createdAt,
          deliveryAddress: data.deliveryAddress || 'To be specified',
          deliveryLocation: data.deliveryLocation,
          userId: data.userId
        });
      }

      if (usedFallback) {
        ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }

      setOrders(ordersData);
      setError(null);
      Toast.show({
        type: 'success',
        text1: 'Orders Loaded',
        text2: 'Your orders have been successfully loaded.'
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders. Please try again later.');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load orders. Please try again later.'
      });
      if (error instanceof Error && 'code' in error && (error as any).code === 'failed-precondition') {
        setError('Please create the required index in Firebase Console');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'confirmed': return colors.info;
      case 'processing': return colors.warning;
      case 'cancelled': return colors.error;
      default: return colors.pending;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'success': return colors.success;
      case 'failed': return colors.error;
      case 'cancelled': return colors.textMuted;
      case 'cash_on_delivery': return colors.warning;
      case 'advance_paid': return colors.info;
      default: return colors.pending;
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'cancelled': return 'ban';
      case 'cash_on_delivery': return 'cash';
      case 'advance_paid': return 'card';
      default: return 'time';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.emptyContainer, {backgroundColor: colors.background}]}>
        <LinearGradient
          colors={[colors.errorLight, colors.error]}
          style={styles.errorIconContainer}
        >
          <Ionicons name="warning-outline" size={50} color="#ffffff" />
        </LinearGradient>
        <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
        {error.includes('index') && (
          <Text style={[styles.helpText, {color: colors.textSecondary}]}>
            Click the link in your console to create the index
          </Text>
        )}
        <TouchableOpacity 
          onPress={handleRefresh}
          style={[styles.refreshButton, {backgroundColor: colors.cardBackground}]}
        >
          <Ionicons name="refresh" size={20} color={colors.info} />
          <Text style={[styles.refreshText, {color: colors.info}]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={[styles.emptyContainer, {backgroundColor: colors.background}]}>
        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          style={styles.emptyIconContainer}
        >
          <Ionicons name="receipt-outline" size={50} color="#ffffff" />
        </LinearGradient>
        <Text style={[styles.emptyText, {color: colors.textPrimary}]}>You have no past orders</Text>
        <TouchableOpacity 
          onPress={handleRefresh}
          style={[styles.refreshButton, {backgroundColor: colors.cardBackground}]}
        >
          <Ionicons name="refresh" size={20} color={colors.info} />
          <Text style={[styles.refreshText, {color: colors.info}]}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Toast />
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.header}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Your Orders</Text>
          <TouchableOpacity 
            style={[styles.refreshIconButton, {backgroundColor: 'rgba(255,255,255,0.2)'}]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons 
              name="refresh" 
              size={24} 
              color={refreshing ? "rgba(255,255,255,0.5)" : "#ffffff"} 
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.orderCard, {backgroundColor: colors.cardBackground}]}>
            {/* Modern Header with Gradient Background */}
            <LinearGradient
              colors={[colors.primaryLight, colors.primary]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.orderHeader}
            >
              <View style={styles.orderHeaderLeft}>
                <Text style={styles.orderId}>#{item.id.substring(0, 8).toUpperCase()}</Text>
                <Text style={styles.orderDate}>
                  {format(item.createdAt, 'MMM dd, yyyy')}
                </Text>
              </View>
              <View style={styles.orderHeaderRight}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Payment Status Section */}
            <View style={[styles.paymentSection, {backgroundColor: colors.cardBackgroundLight}]}>
              <View style={styles.paymentRow}>
                <Ionicons 
                  name={getPaymentStatusIcon(item.paymentStatus || 'pending')} 
                  size={18} 
                  color={getPaymentStatusColor(item.paymentStatus || 'pending')} 
                />
                <Text style={[styles.paymentText, { color: getPaymentStatusColor(item.paymentStatus || 'pending') }]}>
                  {item.paymentStatus === 'cash_on_delivery' ? 'Cash on Delivery' : 
                   item.paymentStatus === 'advance_paid' ? 'Advance Paid' :
                   item.paymentStatus?.replace('_', ' ').toUpperCase() || 'PENDING'}
                </Text>
              </View>
              <View style={styles.paymentMethodContainer}>
                <Ionicons 
                  name={item.paymentMethod === 'online_payment' ? 'card-outline' : 'cash-outline'} 
                  size={16} 
                  color={colors.textSecondary} 
                />
                <Text style={[styles.paymentMethodText, {color: colors.textSecondary}]}>
                  {item.paymentMethod === 'online_payment' ? 'Online Payment' : 'Cash on Delivery'}
                </Text>
              </View>

              {/* Advance Payment Breakdown for COD orders */}
              {item.paymentMethod === 'cash_on_delivery' && item.paymentStatus === 'advance_paid' && (
                <View style={[styles.advancePaymentContainer, {backgroundColor: colors.infoLight, borderColor: colors.info}]}>
                  <View style={styles.advancePaymentHeader}>
                    <Ionicons name="card" size={16} color={colors.info} />
                    <Text style={[styles.advancePaymentTitle, {color: colors.info}]}>Payment Breakdown</Text>
                  </View>
                  
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={[styles.breakdownLabel, {color: colors.textSecondary}]}>Advance Paid:</Text>
                    <Text style={[styles.breakdownAmountPaid, {color: colors.success}]}>৳{(item.advancePaymentAmount || 0).toFixed(2)}</Text>
                  </View>
                  
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={[styles.breakdownLabel, {color: colors.textSecondary}]}>Remaining (COD):</Text>
                    <Text style={[styles.breakdownAmountRemaining, {color: colors.warning}]}>৳{(item.remainingAmount || 0).toFixed(2)}</Text>
                  </View>
                  
                  <View style={[styles.paymentBreakdownRow, styles.totalRow]}>
                    <Text style={[styles.breakdownTotalLabel, {color: colors.textPrimary}]}>Total Order:</Text>
                    <Text style={[styles.breakdownTotalAmount, {color: colors.primary}]}>৳{item.total.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              {/* Regular COD Order (No Advance Payment) */}
              {item.paymentMethod === 'cash_on_delivery' && item.paymentStatus === 'cash_on_delivery' && (
                <View style={[styles.codPaymentContainer, {backgroundColor: colors.warningLight, borderColor: colors.warning}]}>
                  <View style={styles.codPaymentHeader}>
                    <Ionicons name="cash" size={16} color={colors.warning} />
                    <Text style={[styles.codPaymentTitle, {color: colors.warning}]}>Payment Due on Delivery</Text>
                  </View>
                  
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={[styles.breakdownLabel, {color: colors.textSecondary}]}>Amount to Pay on Delivery:</Text>
                    <Text style={[styles.codAmountDue, {color: colors.warning}]}>৳{item.total.toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Items Section with Modern Cards */}
            <View style={styles.itemsSection}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>Items ({item.items.length})</Text>
              {item.items.map((product, index) => (
                <View key={`${product.id}-${index}`} style={[styles.itemCard, {backgroundColor: colors.cardBackgroundLight}]}>
                  <View style={styles.itemImageContainer}>
                    <Image 
                      source={{ uri: product.image }} 
                      style={styles.productImage}
                      defaultSource={{ uri: 'https://via.placeholder.com/60x60/e0e0e0/666?text=IMG' }}
                    />
                    <View style={[styles.quantityBadge, {backgroundColor: colors.info}]}>
                      <Text style={styles.quantityText}>{product.quantity}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.itemDetails}>
                    <Text style={[styles.itemName, {color: colors.textPrimary}]} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={[styles.itemUnit, {color: colors.textSecondary}]}>per {product.unit}</Text>
                    
                    <View style={styles.shopInfoContainer}>
                      <View style={[styles.shopTag, {backgroundColor: colors.successLight}]}>
                        <Ionicons name="storefront" size={12} color={colors.success} />
                        <Text style={[styles.shopTagText, {color: colors.success}]}>{product.shopName}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.itemPriceContainer}>
                    <Text style={[styles.itemPrice, {color: colors.primary}]}>
                      ৳{(product.price * product.quantity).toFixed(2)}
                    </Text>
                    <Text style={[styles.itemUnitPrice, {color: colors.textSecondary}]}>
                      ৳{product.price.toFixed(2)} each
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Modern Footer with Gradients */}
            <LinearGradient
              colors={[colors.cardBackgroundLight, colors.cardBackground]}
              style={styles.orderFooter}
            >
              <View style={styles.totalSection}>
                <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Total Amount</Text>
                <Text style={[styles.totalAmount, {color: colors.primary}]}>৳{item.total.toFixed(2)}</Text>
              </View>
              
              <View style={styles.actionSection}>
                <TouchableOpacity 
                  style={[styles.locationButton, {backgroundColor: colors.infoLight}]}
                  onPress={() => {
                    let addressInfo = item.deliveryAddress;
                    if (item.deliveryLocation && item.deliveryLocation.latitude) {
                      addressInfo += `\n\nCoordinates:\nLat: ${item.deliveryLocation.latitude}\nLng: ${item.deliveryLocation.longitude}`;
                    }
                    Alert.alert(
                      'Delivery Information',
                      addressInfo === 'To be specified' 
                        ? 'No delivery address provided' 
                        : addressInfo
                    );
                  }}
                >
                  <Ionicons name="location" size={16} color={colors.info} />
                  <Text style={[styles.locationButtonText, {color: colors.info}]}>Location</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.detailsButton, {backgroundColor: colors.warningLight}]}
                  onPress={() => {
                    Alert.alert(
                      'Order Details',
                      `Order ID: ${item.id}\nCreated: ${format(item.createdAt, 'MMM dd, yyyy - hh:mm a')}\nStatus: ${item.status}\nPayment: ${item.paymentStatus}\nItems: ${item.items.length}\nTotal: ৳${item.total.toFixed(2)}`
                    );
                  }}
                >
                  <Ionicons name="information-circle" size={16} color={colors.warning} />
                  <Text style={[styles.detailsButtonText, {color: colors.warning}]}>Details</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f7f0',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f7f0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f7f0',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  refreshText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  refreshIconButton: {
    padding: 8,
    borderRadius: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  orderDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  paymentSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 12,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  itemsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemUnit: {
    fontSize: 12,
    marginBottom: 6,
  },
  shopInfoContainer: {
    marginTop: 4,
  },
  shopTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  shopTagText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  itemPriceContainer: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemUnitPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionSection: {
    flexDirection: 'row',
    gap: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationButtonText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsButtonText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  // Advanced Payment Styles
  advancePaymentContainer: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  advancePaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  advancePaymentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  paymentBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 13,
  },
  breakdownAmountPaid: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownAmountRemaining: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: 6,
    marginTop: 6,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  breakdownTotalAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // COD Payment Styles
  codPaymentContainer: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  codPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  codPaymentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  codAmountDue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});