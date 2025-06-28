# Payment Testing Guide

## Issue Fixed: Transaction ID vs Order ID Mismatch

The original error was occurring because the payment system was using different identifiers for the same order:

- **Cart**: Creating order with `orderId` but storing payment info with `transactionId`
- **Payment Status**: Looking for order using `tran_id` from SSL Commerz response

## Solution Implemented

1. **Unified Order ID Usage**: 
   - Order ID (`ORDER_${timestamp}_${random}`) is now used consistently as the transaction ID
   - AsyncStorage keys use the order ID: `pending_payment_${orderId}`
   - Firestore orders are stored with the same order ID as the document ID

2. **Payment Flow**:
   ```
   1. Create order with orderId: "ORDER_1751050156847_344"
   2. Use same orderId as tran_id for SSL Commerz
   3. Store payment info: "pending_payment_ORDER_1751050156847_344"
   4. Update order status using the same orderId
   ```

## Testing Steps

1. **Navigate to Payment Testing Screen**:
   - Go to Profile tab
   - Tap "Payment Testing (Dev)"

2. **Create Test Order**:
   - Tap "Create Test Order" button
   - This creates a test order in Firestore and AsyncStorage

3. **Simulate Payment**:
   - View pending payments in the list
   - Tap "Simulate Success" or "Simulate Failure"
   - Check that order status updates correctly

4. **Verify in Firestore**:
   - Order document should exist with correct ID
   - Payment status should update from "pending" to "success"/"failed"

## Key Changes Made

1. **cart.tsx**: 
   - Changed `pending_payment_${transactionId}` to `pending_payment_${orderId}`
   - Ensures consistent ID usage

2. **paymentStatus.ts**:
   - Added debug logging to track payment processing
   - Order lookup uses `tran_id` (which is now the order ID)

3. **testPayment.ts**:
   - New utility for creating test orders
   - Helps test the payment flow without real transactions

## Debug Information

The payment testing screen now shows detailed logs in the console:
- AsyncStorage keys being checked
- Payment data being processed
- Order lookup results

## Production Considerations

- Remove or hide test utilities in production builds
- Implement proper SSL Commerz webhook handling for automatic payment status updates
- Add proper error handling for network issues during payment processing
