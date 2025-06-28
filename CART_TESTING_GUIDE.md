# Cart Functionality Testing Guide

## Overview
The cart functionality has been fully implemented with both database storage and user interface. All cart data is properly stored in the Firestore `carts` collection with user-specific documents.

## Features Implemented

### 🛒 **Cart Management**
- **Add to Cart**: Users can add products from both the products listing page and individual product pages
- **Database Storage**: All cart items are stored in Firestore under `carts/{userId}` documents
- **Real-time Sync**: Cart data syncs between device and database automatically
- **Quantity Management**: Users can increase/decrease quantities or remove items entirely

### 💰 **Advanced Payment Features**
- **Cash on Delivery (COD)**: Requires 10% advance payment online
- **Online Payment**: Full SSL Commerz integration
- **Payment Breakdown**: Clear display of advance payment vs delivery payment for COD

### 🗺️ **Location Features**
- **Map-based Delivery Selection**: Users can select delivery location on map
- **Location Storage**: Coordinates stored in requested format (`latitude(number/string)`, `longitude(number/string)`)

## How to Test Cart Functionality

### Method 1: Add Test Data (Recommended)
1. Open the app on your device/simulator
2. Navigate to the **Products** tab
3. Click the **"Add Test Items"** button in the header
4. Navigate to the **Cart** tab to see the added items

### Method 2: Add Real Products
1. Go to the **Products** tab
2. Click on any product card to view details
3. Click **"Add to Cart"** button on the product detail page
4. OR click the small green cart icon (⊕) on product cards in the listing

### Method 3: Quick Add from Products Page
1. Browse products in the **Products** tab
2. Click the small green cart button in the bottom-right corner of any product card
3. You'll see a success toast notification
4. Navigate to **Cart** tab to verify

## Testing COD Advance Payment

### Steps to Test:
1. Add items to cart using any method above
2. Go to **Cart** tab
3. Click **"Set Delivery Details"**
4. Select **"Cash on Delivery (10% advance required)"**
5. Notice the orange warning box showing advance payment requirement
6. Save details and close modal
7. Observe the payment breakdown showing:
   - Online Advance (10%)
   - Cash on Delivery (90%)
8. Click **"Place COD Order"** (orange button)
9. Review the advance payment modal
10. Click **"Pay Advance ৳XX.XX"** to proceed with SSL Commerz

## Database Structure

### Cart Collection
```
carts/
  └── {userId}/
      └── items: [
          {
            id: string,
            name: string,
            price: number,
            quantity: number,
            unit: string,
            image: string,
            shopId: string,
            shopName: string,
            farmerId: string
          }
        ]
```

### Order Collection (after purchase)
```
orders/
  └── {orderId}/
      ├── userId: string
      ├── userEmail: string
      ├── items: CartItem[]
      ├── total: number
      ├── paymentMethod: 'cash_on_delivery' | 'online_payment'
      ├── paymentStatus: 'pending' | 'advance_paid' | 'cash_on_delivery' | 'failed'
      ├── advancePaymentAmount: number (for COD)
      ├── remainingAmount: number (for COD)
      ├── deliveryAddress: string
      ├── deliveryLocation: LocationData
      └── 'delivery location(map)': {
           'latitude(number/string)': string,
           'longitude(number/string)': string
         }
```

## Troubleshooting

### Cart appears empty:
1. Ensure you're logged in
2. Try adding test data using the "Add Test Items" button
3. Check if products exist in the Products tab
4. Verify network connection

### Cart not syncing:
1. Check authentication status
2. Verify Firestore permissions
3. Look for error messages in console/logs

### Payment issues:
1. Ensure SSL Commerz credentials are configured
2. Check network connectivity
3. Verify payment URLs in SSL Commerz settings

## UI/UX Features

### Modern Design Elements:
- **Card-based layouts** with shadows and rounded corners
- **Color-coded payment methods** (Orange for COD, Blue for online)
- **Interactive elements** with loading states
- **Toast notifications** for user feedback
- **Professional modals** with clear information hierarchy
- **Responsive design** optimized for mobile

### Cart Page Features:
- Item quantity controls (+ / -)
- Remove individual items
- Clear entire cart
- Total calculation
- Payment method selection
- Delivery address and location selection
- Payment breakdown for COD
- Modern button styling

## Production Notes

- Remove or hide the "Add Test Items" button in production
- Configure proper SSL Commerz production credentials
- Set up webhook endpoints for automatic payment status updates
- Implement proper error logging and monitoring

The cart functionality is now fully operational with modern UI/UX and complete database integration!
