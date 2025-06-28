import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { collection, query, where, getDocs, getFirestore, orderBy, doc, getDoc } from 'firebase/firestore';
import { app } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';

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
      case 'completed': return '#4CAF50';
      case 'confirmed': return '#2196F3';
      case 'processing': return '#FF9800';
      case 'cancelled': return '#F44336';
      default: return '#FFC107';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'cancelled': return '#9E9E9E';
      case 'cash_on_delivery': return '#FF9800';
      case 'advance_paid': return '#2196F3';
      default: return '#FFC107';
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="warning-outline" size={50} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        {error.includes('index') && (
          <Text style={styles.helpText}>
            Click the link in your console to create the index
          </Text>
        )}
        <TouchableOpacity 
          onPress={handleRefresh}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={20} color="#2e86de" />
          <Text style={styles.refreshText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={50} color="#ccc" />
        <Text style={styles.emptyText}>You have no past orders</Text>
        <TouchableOpacity 
          onPress={handleRefresh}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={20} color="#2e86de" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast />
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Your Orders</Text>
        <TouchableOpacity 
          style={styles.refreshIconButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color={refreshing ? "#ccc" : "#2196F3"} 
          />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            {/* Modern Header with Gradient-like Background */}
            <View style={styles.orderHeader}>
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
            </View>

            {/* Payment Status Section */}
            <View style={styles.paymentSection}>
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
                  color="#666" 
                />
                <Text style={styles.paymentMethodText}>
                  {item.paymentMethod === 'online_payment' ? 'Online Payment' : 'Cash on Delivery'}
                </Text>
              </View>

              {/* Advance Payment Breakdown for COD orders */}
              {item.paymentMethod === 'cash_on_delivery' && item.paymentStatus === 'advance_paid' && (
                <View style={styles.advancePaymentContainer}>
                  <View style={styles.advancePaymentHeader}>
                    <Ionicons name="card" size={16} color="#2196F3" />
                    <Text style={styles.advancePaymentTitle}>Payment Breakdown</Text>
                  </View>
                  
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={styles.breakdownLabel}>Advance Paid:</Text>
                    <Text style={styles.breakdownAmountPaid}>৳{(item.advancePaymentAmount || 0).toFixed(2)}</Text>
                  </View>
                  
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={styles.breakdownLabel}>Remaining (COD):</Text>
                    <Text style={styles.breakdownAmountRemaining}>৳{(item.remainingAmount || 0).toFixed(2)}</Text>
                  </View>
                  
                  <View style={[styles.paymentBreakdownRow, styles.totalRow]}>
                    <Text style={styles.breakdownTotalLabel}>Total Order:</Text>
                    <Text style={styles.breakdownTotalAmount}>৳{item.total.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              {/* Regular COD Order (No Advance Payment) */}
              {item.paymentMethod === 'cash_on_delivery' && item.paymentStatus === 'cash_on_delivery' && (
                <View style={styles.codPaymentContainer}>
                  <View style={styles.codPaymentHeader}>
                    <Ionicons name="cash" size={16} color="#FF9800" />
                    <Text style={styles.codPaymentTitle}>Payment Due on Delivery</Text>
                  </View>
                  
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={styles.breakdownLabel}>Amount to Pay on Delivery:</Text>
                    <Text style={styles.codAmountDue}>৳{item.total.toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Items Section with Modern Cards */}
            <View style={styles.itemsSection}>
              <Text style={styles.sectionTitle}>Items ({item.items.length})</Text>
              {item.items.map((product, index) => (
                <View key={`${product.id}-${index}`} style={styles.itemCard}>
                  <View style={styles.itemImageContainer}>
                    <Image 
                      source={{ uri: product.image }} 
                      style={styles.productImage}
                      defaultSource={{ uri: 'https://via.placeholder.com/60x60/e0e0e0/666?text=IMG' }}
                    />
                    <View style={styles.quantityBadge}>
                      <Text style={styles.quantityText}>{product.quantity}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.itemUnit}>per {product.unit}</Text>
                    
                    <View style={styles.shopInfoContainer}>
                      <View style={styles.shopTag}>
                        <Ionicons name="storefront" size={12} color="#4CAF50" />
                        <Text style={styles.shopTagText}>{product.shopName}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.itemPriceContainer}>
                    <Text style={styles.itemPrice}>
                      ৳{(product.price * product.quantity).toFixed(2)}
                    </Text>
                    <Text style={styles.itemUnitPrice}>
                      ৳{product.price.toFixed(2)} each
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Modern Footer */}
            <View style={styles.orderFooter}>
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>৳{item.total.toFixed(2)}</Text>
              </View>
              
              <View style={styles.actionSection}>
                <TouchableOpacity 
                  style={styles.locationButton}
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
                  <Ionicons name="location" size={16} color="#2196F3" />
                  <Text style={styles.locationButtonText}>Location</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.detailsButton}
                  onPress={() => {
                    Alert.alert(
                      'Order Details',
                      `Order ID: ${item.id}\nCreated: ${format(item.createdAt, 'MMM dd, yyyy - hh:mm a')}\nStatus: ${item.status}\nPayment: ${item.paymentStatus}\nItems: ${item.items.length}\nTotal: ৳${item.total.toFixed(2)}`
                    );
                  }}
                >
                  <Ionicons name="information-circle" size={16} color="#FF9800" />
                  <Text style={styles.detailsButtonText}>Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f7fa',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  refreshText: {
    color: '#2e86de',
    marginLeft: 8,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  refreshIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
  },
  listContent: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
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
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
    color: '#1a1a1a',
    marginBottom: 4,
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
    color: '#666',
    fontWeight: '500',
  },
  paymentSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafbfc',
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
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  itemsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#e9ecef',
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#2196F3',
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
    color: '#333',
    marginBottom: 4,
  },
  itemUnit: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  shopInfoContainer: {
    marginTop: 4,
  },
  shopTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  shopTagText: {
    fontSize: 11,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '600',
  },
  itemPriceContainer: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e86de',
  },
  itemUnitPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e86de',
  },
  actionSection: {
    flexDirection: 'row',
    gap: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationButtonText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '600',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsButtonText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 4,
    fontWeight: '600',
  },
  // Legacy styles for compatibility
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shopInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  shopInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e86de',
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '60%',
  },
  addressText: {
    fontSize: 14,
    color: '#2e86de',
    marginLeft: 4,
  },
  // Advance Payment Styles
  advancePaymentContainer: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  advancePaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  advancePaymentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginLeft: 6,
  },
  paymentBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
  },
  breakdownAmountPaid: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  breakdownAmountRemaining: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9800',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 6,
    marginTop: 6,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  breakdownTotalAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e86de',
  },
  // COD Payment Styles
  codPaymentContainer: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  codPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  codPaymentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginLeft: 6,
  },
  codAmountDue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
  },
});