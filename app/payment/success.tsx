import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing payment...');

  useEffect(() => {
    handlePaymentSuccess();
  }, []);

  const handlePaymentSuccess = async () => {
    try {
      console.log('Payment success params:', params);
      
      // Extract transaction ID from params
      const tranId = params.tran_id as string;
      const status = params.status as string;
      const amount = params.amount as string;
      const currency = params.currency as string;
      
      if (!tranId) {
        throw new Error('Transaction ID not found');
      }

      // Validate payment status
      if (status !== 'VALID') {
        throw new Error(`Payment validation failed. Status: ${status}`);
      }

      // Find and update the order in Firestore
      // First, try to find the order by transaction ID
      const orderRef = doc(db, 'orders', tranId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        // If not found by transaction ID, we might need to search through orders
        // For now, we'll log this case
        console.warn('Order not found with transaction ID:', tranId);
        throw new Error('Order not found');
      }

      // Update the order status
      await updateDoc(orderRef, {
        paymentStatus: 'success',
        paymentCompletedAt: new Date().toISOString(),
        sslCommerzResponse: {
          status: status,
          amount: amount,
          currency: currency,
          tran_id: tranId,
          updatedAt: new Date().toISOString()
        }
      });

      console.log('Order payment status updated successfully:', tranId);
      
      setStatus('success');
      setMessage(`Payment successful! Amount: ${currency} ${amount}`);
      
      // Redirect to orders page after 3 seconds
      setTimeout(() => {
        router.replace('/(tabs)/orders');
      }, 3000);

    } catch (error) {
      console.error('Payment success handling error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Payment processing failed');
      
      // Show alert and redirect
      Alert.alert(
        'Payment Error',
        'There was an issue processing your payment. Please check your orders or contact support.',
        [
          {
            text: 'Go to Orders',
            onPress: () => router.replace('/(tabs)/orders')
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {loading && (
          <>
            <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
            <ThemedText style={styles.title}>Processing Payment</ThemedText>
            <ThemedText style={styles.message}>Please wait while we confirm your payment...</ThemedText>
          </>
        )}
        
        {!loading && status === 'success' && (
          <>
            <View style={styles.successIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <ThemedText style={[styles.title, styles.successTitle]}>Payment Successful!</ThemedText>
            <ThemedText style={styles.message}>{message}</ThemedText>
            <ThemedText style={styles.redirectMessage}>Redirecting to your orders...</ThemedText>
          </>
        )}
        
        {!loading && status === 'error' && (
          <>
            <View style={styles.errorIcon}>
              <Text style={styles.errorMark}>✗</Text>
            </View>
            <ThemedText style={[styles.title, styles.errorTitle]}>Payment Error</ThemedText>
            <ThemedText style={styles.message}>{message}</ThemedText>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  loader: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  successTitle: {
    color: '#4CAF50',
  },
  errorTitle: {
    color: '#f44336',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  redirectMessage: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
  errorMark: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
});
