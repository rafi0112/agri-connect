# SSL Commerz Integration Setup Guide

## Step 1: SSL Commerz Account Setup

1. **Create SSL Commerz Account**
   - Visit: https://sslcommerz.com/
   - Register for a merchant account
   - Complete the verification process

2. **Get API Credentials**
   - Login to your SSL Commerz merchant panel
   - Navigate to "API Integration" section
   - Copy your `Store ID` and `Store Password`

## Step 2: Update Configuration

1. **Edit `utils/sslcommerz.ts`**
   ```typescript
   const SSL_CONFIG = {
     store_id: 'your_actual_store_id', // Replace with your SSL Commerz store ID
     store_passwd: 'your_actual_store_password', // Replace with your SSL Commerz store password
     sandbox: true, // Set to false for production
     success_url: 'https://developer.sslcommerz.com/example/success.php', // Update for production
     fail_url: 'https://developer.sslcommerz.com/example/fail.php', // Update for production
     cancel_url: 'https://developer.sslcommerz.com/example/cancel.php', // Update for production
     ipn_url: 'https://developer.sslcommerz.com/example/ipn.php', // Update for production
   };
   ```

2. **Default Test Credentials (Already Set)**
   - Store ID: `testbox`
   - Store Password: `qwerty`
   - These are SSL Commerz's default sandbox credentials for testing

3. **Update URLs for Production**
   - Replace example URLs with your actual app's callback URLs
   - Ensure proper SSL certificate on your callback URLs

## Step 3: Test SSL Commerz Integration

### Sandbox Testing
- Use sandbox mode for testing (sandbox: true)
- SSL Commerz provides test cards for payment testing
- Test cards: 4111111111111111 (Visa), 5555555555554444 (MasterCard)

### Production Setup
- Set `sandbox: false` in SSL_CONFIG
- Use production API credentials
- Ensure proper SSL certificate on your callback URLs

## Step 4: Handle Payment Callbacks

You'll need to implement server-side endpoints to handle payment callbacks:

1. **Success URL**: Handle successful payments
2. **Fail URL**: Handle failed payments
3. **Cancel URL**: Handle cancelled payments
4. **IPN URL**: Handle instant payment notifications

## Step 5: Firebase Security Rules

Add security rules for orders collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## Step 6: Testing the Integration

### Method 1: Payment Testing Screen (Recommended for Development)

1. **Access Testing Screen**
   - Go to Profile tab in the app
   - Click "Payment Testing (Dev)" option
   - This opens a dedicated testing interface

2. **Test Payment Flow**
   - Add items to cart
   - Set delivery details and select "Online Payment (SSL Commerz)"
   - Click "Pay Online" to create a pending payment
   - Use the Payment Testing screen to simulate success/failure

3. **Simulate Payment Results**
   - **Success**: Click "Simulate Success" to mark payment as successful
   - **Failure**: Click "Simulate Failure" to mark payment as failed
   - Check orders tab to verify status updates

### Method 2: SSL Commerz Sandbox Testing

1. **Test Location Selection**
   - Open cart screen
   - Click "Set Delivery Details"
   - Click "Select Location on Map"
   - Select a location and confirm

2. **Test Payment Flow**
   - Add items to cart
   - Set delivery details
   - Select "Online Payment (SSL Commerz)"
   - Click "Pay Online"
   - Use SSL Commerz test cards in the sandbox

3. **SSL Commerz Test Cards**
   - **Success**: 4242424242424242
   - **Failed**: 4000000000000002
   - **CVV**: Any 3 digits
   - **Expiry**: Any future date

**Note**: Currently, automatic payment status updates from SSL Commerz callbacks are not implemented. Use the Payment Testing screen to manually update payment status after testing.

## Additional Features Implemented

### 🗺️ Location Selection
- Interactive map for delivery location selection
- Current location detection
- Address geocoding and reverse geocoding
- Location data stored in Firebase and AsyncStorage

### 💳 Payment Methods
- Cash on Delivery
- SSL Commerz Online Payment
- Payment status tracking
- Transaction ID generation

### 📦 Order Management
- Enhanced order data structure
- Payment status tracking
- Delivery location coordinates
- Order history with payment details

## Environment Variables (Optional)

Create a `.env` file for sensitive configurations:

```env
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
SSLCOMMERZ_SANDBOX=true
```

## Troubleshooting

### Common Issues

1. **Payment Gateway Not Opening**
   - Check internet connection
   - Verify SSL Commerz credentials
   - Ensure proper URL formatting

2. **Location Not Loading**
   - Grant location permissions
   - Check GPS/network connectivity
   - Verify Google Maps API key (if using Google Maps)

3. **Order Not Saving**
   - Check Firebase connection
   - Verify user authentication
   - Check Firebase security rules

### Support

For SSL Commerz integration issues:
- Documentation: https://developer.sslcommerz.com/
- Support: support@sslcommerz.com

For app-specific issues:
- Check console logs for detailed error messages
- Verify Firebase configuration
- Test with different payment amounts
