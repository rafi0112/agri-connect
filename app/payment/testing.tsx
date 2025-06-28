import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { checkPendingPayments, simulatePaymentSuccess, simulatePaymentFailure } from '../../utils/paymentStatus';
import { createTestOrder, clearTestData } from '../../utils/testPayment';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { app } from '../../config/firebase';

interface PendingPayment {
  key: string;
  orderId: string;
  amount: number;
  totalAmount: number;
  isAdvancePayment?: boolean;
  timestamp: number;
}

export default function PaymentTesting() {
  const { user } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [onlinePayments, setOnlinePayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const db = getFirestore(app);

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      console.log('=== Loading Pending Payments ===');
      setLoading(true);
      const payments = await checkPendingPayments();
      console.log('Loaded payments:', payments);
      
      // Filter for online payments only (not COD advance payments)
      const onlinePaymentsOnly = [];
      
      for (const payment of payments) {
        // Check if this is NOT an advance payment (online payments only)
        if (!payment.isAdvancePayment) {
          // Verify the order exists and is online payment
          try {
            const orderRef = doc(db, 'orders', payment.orderId);
            const orderDoc = await getDoc(orderRef);
            
            if (orderDoc.exists()) {
              const orderData = orderDoc.data();
              if (orderData.paymentMethod === 'online_payment' && 
                  (orderData.paymentStatus === 'pending' || orderData.paymentStatus === 'failed')) {
                onlinePaymentsOnly.push(payment);
              }
            }
          } catch (error) {
            console.error('Error checking order:', error);
          }
        }
      }
      
      setPendingPayments(payments);
      setOnlinePayments(onlinePaymentsOnly);
      console.log('Online payments found:', onlinePaymentsOnly);
    } catch (error) {
      console.error('Error loading pending payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSuccess = async (orderId: string, amount: number) => {
    try {
      setProcessing(orderId);
      
      // Simulate the payment success
      const result = await simulatePaymentSuccess(orderId, amount);
      
      if (result.success) {
        // For online payments, update the order status to 'success'
        try {
          const orderRef = doc(db, 'orders', orderId);
          await updateDoc(orderRef, {
            paymentStatus: 'success',
            status: 'confirmed',
            paymentCompletedAt: new Date().toISOString(),
          });
          
          Alert.alert(
            'Payment Success',
            `Online payment of ৳${amount.toFixed(2)} for order ${orderId} has been processed successfully!`,
            [{ text: 'OK', onPress: loadPendingPayments }]
          );
        } catch (error) {
          console.error('Error updating order:', error);
          Alert.alert('Error', 'Payment was processed but failed to update order status');
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to process payment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to simulate payment success');
    } finally {
      setProcessing(null);
    }
  };

  const handleSimulateFailure = async (orderId: string, amount: number) => {
    try {
      setProcessing(orderId);
      
      // Simulate the payment failure
      const result = await simulatePaymentFailure(orderId, amount);
      
      if (result.success) {
        // For online payments, update the order status to 'failed'
        try {
          const orderRef = doc(db, 'orders', orderId);
          await updateDoc(orderRef, {
            paymentStatus: 'failed',
            status: 'cancelled',
            paymentFailedAt: new Date().toISOString(),
          });
          
          Alert.alert(
            'Payment Failed',
            `Online payment for order ${orderId} has been marked as failed.`,
            [{ text: 'OK', onPress: loadPendingPayments }]
          );
        } catch (error) {
          console.error('Error updating order:', error);
          Alert.alert('Error', 'Payment was marked as failed but order status update failed');
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to process payment failure');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to simulate payment failure');
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateTestOrder = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to create a test order');
      return;
    }

    try {
      setProcessing('creating');
      const result = await createTestOrder(user.id);
      
      if (result.success) {
        Alert.alert(
          'Test Order Created',
          `Test order ${result.orderId} has been created!`,
          [{ text: 'OK', onPress: loadPendingPayments }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to create test order');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create test order');
    } finally {
      setProcessing(null);
    }
  };

  const handleClearTestData = async () => {
    try {
      setProcessing('clearing');
      const result = await clearTestData();
      
      if (result.success) {
        Alert.alert(
          'Test Data Cleared',
          `Cleared ${result.clearedKeys} test data entries`,
          [{ text: 'OK', onPress: loadPendingPayments }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to clear test data');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to clear test data');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <ThemedText style={styles.loadingText}>Loading pending payments...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <ThemedText style={styles.title}>Online Payment Testing</ThemedText>
        <ThemedText style={styles.subtitle}>
          Simulate success or failure for online payment orders.
        </ThemedText>

        <TouchableOpacity style={styles.refreshButton} onPress={loadPendingPayments}>
          <Text style={styles.refreshButtonText}>Refresh Pending Payments</Text>
        </TouchableOpacity>

        <View style={styles.testUtilsContainer}>
          <TouchableOpacity 
            style={[styles.testButton, styles.createButton]} 
            onPress={handleCreateTestOrder}
            disabled={processing === 'creating'}
          >
            {processing === 'creating' ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.testButtonText}>Create Test Order</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.clearButton]} 
            onPress={handleClearTestData}
            disabled={processing === 'clearing'}
          >
            {processing === 'clearing' ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.testButtonText}>Clear Test Data</Text>
            )}
          </TouchableOpacity>
        </View>

        {onlinePayments.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No Online Payments Found</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Place an order with online payment to test it here
            </ThemedText>
          </View>
        ) : (
          <View style={styles.paymentsContainer}>
            <ThemedText style={styles.sectionTitle}>Online Payments ({onlinePayments.length})</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              Only online payment orders can be tested here
            </ThemedText>
            
            {onlinePayments.map((payment) => (
              <View key={payment.key} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <ThemedText style={styles.orderId}>Order: {payment.orderId}</ThemedText>
                  <View style={styles.paymentBadge}>
                    <ThemedText style={styles.badgeText}>Online Payment</ThemedText>
                  </View>
                </View>
                
                <View style={styles.paymentBreakdown}>
                  <View style={styles.breakdownRow}>
                    <ThemedText style={styles.breakdownLabel}>Payment Amount:</ThemedText>
                    <ThemedText style={styles.totalAmount}>৳{payment.amount.toFixed(2)}</ThemedText>
                  </View>
                  <View style={styles.breakdownRow}>
                    <ThemedText style={styles.breakdownLabel}>Payment Method:</ThemedText>
                    <ThemedText style={styles.advanceAmount}>SSL Commerz</ThemedText>
                  </View>
                </View>
                
                <ThemedText style={styles.timestamp}>
                  Created: {new Date(payment.timestamp).toLocaleString()}
                </ThemedText>
                
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.successButton]}
                    onPress={() => handleSimulateSuccess(payment.orderId, payment.amount)}
                    disabled={processing === payment.orderId}
                  >
                    {processing === payment.orderId ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.buttonText}>Simulate Success</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.failButton]}
                    onPress={() => handleSimulateFailure(payment.orderId, payment.amount)}
                    disabled={processing === payment.orderId}
                  >
                    {processing === payment.orderId ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.buttonText}>Simulate Failure</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.7,
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 20,
    textAlign: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  paymentsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  paymentCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  failButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  testUtilsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  testButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  clearButton: {
    backgroundColor: '#ff9800',
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // New styles for online payment testing
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  paymentBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentBreakdown: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  advanceAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
  },
  totalAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  remainingAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9800',
  },
});
