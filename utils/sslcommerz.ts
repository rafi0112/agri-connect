import { Linking } from 'react-native';

// SSL Commerz configuration
const SSL_CONFIG = {
  store_id: 'testbox', // Default sandbox store ID - Replace with your actual store ID
  store_passwd: 'qwerty', // Default sandbox password - Replace with your actual store password
  sandbox: true, // Set to false for production
  // For testing: Using webhook.site URLs that can redirect to deep links
  // Replace these with your actual server URLs in production
  success_url: 'https://webhook.site/unique-id-success', // Replace with your server URL
  fail_url: 'https://webhook.site/unique-id-fail', // Replace with your server URL  
  cancel_url: 'https://webhook.site/unique-id-cancel', // Replace with your server URL
  ipn_url: 'https://webhook.site/unique-id-ipn', // Replace with your server URL
  
  // Deep link URLs (for reference - use these in your server redirects)
  deep_links: {
    success: 'agriconnect://payment/success',
    fail: 'agriconnect://payment/fail',
    cancel: 'agriconnect://payment/cancel',
  }
};

export interface PaymentData {
  total_amount: number;
  currency: string;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url: string;
  shipping_method: string;
  product_name: string;
  product_category: string;
  product_profile: string;
  cus_name: string;
  cus_email: string;
  cus_add1: string;
  cus_add2?: string;
  cus_city: string;
  cus_state?: string;
  cus_postcode?: string;
  cus_country: string;
  cus_phone: string;
  cus_fax?: string;
  ship_name: string; // Required by SSL Commerz
  ship_add1: string; // Required by SSL Commerz
  ship_add2?: string;
  ship_city: string; // Required by SSL Commerz
  ship_state?: string;
  ship_postcode?: string;
  ship_country: string; // Required by SSL Commerz
  value_a?: string;
  value_b?: string;
  value_c?: string;
  value_d?: string;
}

export const initiateSSLCommerzPayment = async (paymentData: PaymentData) => {
  try {
    // Validate required fields
    const requiredFields = [
      'total_amount', 'currency', 'tran_id', 'cus_name', 'cus_email', 
      'cus_add1', 'cus_city', 'cus_country', 'cus_phone',
      'ship_name', 'ship_add1', 'ship_city', 'ship_country'
    ];
    
    for (const field of requiredFields) {
      if (!paymentData[field as keyof PaymentData]) {
        throw new Error(`Required field '${field}' is missing or empty`);
      }
    }

    const baseUrl = SSL_CONFIG.sandbox 
      ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
      : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

    const formData = new FormData();
    formData.append('store_id', SSL_CONFIG.store_id);
    formData.append('store_passwd', SSL_CONFIG.store_passwd);
    
    // Add all payment data to form
    Object.entries(paymentData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    console.log('Initiating SSL Commerz Payment with data:', {
      store_id: SSL_CONFIG.store_id,
      total_amount: paymentData.total_amount,
      tran_id: paymentData.tran_id,
      ship_name: paymentData.ship_name,
      ship_add1: paymentData.ship_add1,
    });

    const response = await fetch(baseUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('SSL Commerz Response:', result);
    
    if (result.status === 'SUCCESS') {
      // Open the payment URL in browser
      const paymentUrl = result.GatewayPageURL;
      const supported = await Linking.canOpenURL(paymentUrl);
      
      if (supported) {
        await Linking.openURL(paymentUrl);
        return { success: true, data: result };
      } else {
        throw new Error('Cannot open payment URL');
      }
    } else {
      const errorMessage = result.failedreason || result.message || 'Payment initiation failed';
      console.error('SSL Commerz Error Response:', result);
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('SSL Commerz Payment Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage };
  }
};

export const generateTransactionId = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `TXN${timestamp}${random}`;
};

export const validatePaymentResponse = (response: any) => {
  // Implement validation logic based on your needs
  return response && response.status === 'VALID';
};
