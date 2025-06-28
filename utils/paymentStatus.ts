import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PaymentStatusUpdate {
  tran_id: string;
  status: 'VALID' | 'FAILED' | 'CANCELLED';
  amount: string;
  currency: string;
  tran_date: string;
  card_type?: string;
  card_no?: string;
  bank_tran_id?: string;
}

export const updatePaymentStatus = async (paymentData: PaymentStatusUpdate) => {
  try {
    console.log('Updating payment status:', paymentData);
    
    const orderId = paymentData.tran_id;
    const orderRef = doc(db, 'orders', orderId);
    
    // Check if order exists
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) {
      throw new Error(`Order not found: ${orderId}`);
    }
    
    const orderData = orderDoc.data();
    console.log('Found order:', { id: orderId, total: orderData.total });
    
    // Validate amount matches
    if (parseFloat(paymentData.amount) !== orderData.total) {
      console.warn('Payment amount mismatch:', {
        expected: orderData.total,
        received: parseFloat(paymentData.amount)
      });
    }
    
    // Update payment status based on SSL Commerz response
    let paymentStatus = 'failed';
    let orderStatus = orderData.status;
    
    if (paymentData.status === 'VALID') {
      paymentStatus = 'success';
      orderStatus = 'confirmed';
    } else if (paymentData.status === 'CANCELLED') {
      paymentStatus = 'cancelled';
    }
    
    // Update the order
    await updateDoc(orderRef, {
      paymentStatus: paymentStatus,
      orderStatus: orderStatus,
      paymentCompletedAt: new Date().toISOString(),
      sslCommerzResponse: {
        status: paymentData.status,
        amount: paymentData.amount,
        currency: paymentData.currency,
        tran_id: paymentData.tran_id,
        tran_date: paymentData.tran_date,
        card_type: paymentData.card_type,
        card_no: paymentData.card_no,
        bank_tran_id: paymentData.bank_tran_id,
        updatedAt: new Date().toISOString()
      }
    });
    
    // Clear pending payment from AsyncStorage
    await AsyncStorage.removeItem(`pending_payment_${orderId}`);
    
    console.log('Payment status updated successfully:', {
      orderId,
      paymentStatus,
      orderStatus
    });
    
    return { success: true, orderId, paymentStatus, orderStatus };
    
  } catch (error) {
    console.error('Error updating payment status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Function to check and handle pending payments (for testing)
export const checkPendingPayments = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pendingPaymentKeys = keys.filter(key => key.startsWith('pending_payment_'));
    
    console.log('All AsyncStorage keys:', keys);
    console.log('Found pending payment keys:', pendingPaymentKeys);
    
    const pendingPayments = [];
    for (const key of pendingPaymentKeys) {
      const paymentData = await AsyncStorage.getItem(key);
      console.log(`Payment data for ${key}:`, paymentData);
      
      if (paymentData) {
        const payment = JSON.parse(paymentData);
        pendingPayments.push({
          key,
          ...payment,
          orderId: key.replace('pending_payment_', '')
        });
      }
    }
    
    console.log('Processed pending payments:', pendingPayments);
    return pendingPayments;
  } catch (error) {
    console.error('Error checking pending payments:', error);
    return [];
  }
};

// For testing: simulate successful payment
export const simulatePaymentSuccess = async (orderId: string, amount: number) => {
  const mockPaymentData: PaymentStatusUpdate = {
    tran_id: orderId,
    status: 'VALID',
    amount: amount.toString(),
    currency: 'BDT',
    tran_date: new Date().toISOString(),
    card_type: 'VISA',
    card_no: '4242***4242',
    bank_tran_id: `BANK_${Date.now()}`
  };
  
  return await updatePaymentStatus(mockPaymentData);
};

// For testing: simulate failed payment
export const simulatePaymentFailure = async (orderId: string, amount: number) => {
  const mockPaymentData: PaymentStatusUpdate = {
    tran_id: orderId,
    status: 'FAILED',
    amount: amount.toString(),
    currency: 'BDT',
    tran_date: new Date().toISOString()
  };
  
  return await updatePaymentStatus(mockPaymentData);
};
