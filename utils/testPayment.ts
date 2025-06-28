import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const createTestOrder = async (userId: string) => {
  try {
    const orderId = `TEST_ORDER_${Date.now()}`;
    
    // Create a test order in Firestore
    const orderData = {
      userId: userId,
      userEmail: 'test@example.com',
      items: [
        {
          id: 'test-item-1',
          name: 'Test Product',
          price: 100,
          quantity: 2,
          unit: 'kg',
          shopId: 'test-shop',
          shopName: 'Test Shop',
          farmerId: 'test-farmer',
        }
      ],
      total: 200,
      status: 'pending',
      createdAt: new Date(),
      deliveryAddress: 'Test Address',
      paymentMethod: 'online_payment',
      paymentStatus: 'pending',
      'delivery location(map)': {
        latitude: '23.8103',
        longitude: '90.4125'
      }
    };

    // Create order document
    const orderRef = doc(db, 'orders', orderId);
    await setDoc(orderRef, orderData);

    // Store pending payment info
    await AsyncStorage.setItem(`pending_payment_${orderId}`, JSON.stringify({
      orderId,
      amount: 200,
      timestamp: Date.now(),
    }));

    console.log('Test order created:', orderId);
    return { success: true, orderId };
  } catch (error) {
    console.error('Error creating test order:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const clearTestData = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const testKeys = keys.filter(key => 
      key.startsWith('pending_payment_TEST_ORDER_') || 
      key.startsWith('deliveryLocation_')
    );
    
    if (testKeys.length > 0) {
      await AsyncStorage.multiRemove(testKeys);
      console.log('Cleared test data keys:', testKeys);
    }
    
    return { success: true, clearedKeys: testKeys.length };
  } catch (error) {
    console.error('Error clearing test data:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
