# Location-Based Product Filtering Feature

This feature allows users to filter products by nearby shops based on their current location.

## Features Implemented

### 1. **Location-Based Product Filtering**
- **Automatic Location Detection**: Requests user permission to access location
- **Distance Calculation**: Uses Haversine formula to calculate accurate distances
- **Filter Toggle**: Users can enable/disable location-based filtering
- **Distance Range Selection**: Users can choose from 5km, 10km, 20km, or 50km radius
- **Real-time Filtering**: Products are filtered and sorted by distance in real-time

### 2. **Enhanced Product Display**
- **Shop Information**: Shows shop name for each product
- **Distance Display**: Shows distance to shop in km or meters (auto-formatted)
- **Visual Indicators**: Location icons and distance badges
- **Sorting**: Products are automatically sorted by distance when location is enabled

### 3. **Map Integration**
- **Interactive Map**: View nearby shops on a map with markers
- **User Location Marker**: Shows user's current position
- **Shop Markers**: Different colored markers for shops
- **Distance Circle**: Visual radius indicator on map
- **Shop Selection**: Tap on shop markers for details

### 4. **Product Detail Enhancement**
- **Distance Information**: Shows exact distance to shop in product details
- **Location Display**: Enhanced location information with coordinates
- **Shop Details**: Comprehensive shop information including location

## Technical Implementation

### **Files Created/Modified:**

#### **New Files:**
1. `utils/location.ts` - Location utility functions
2. `components/NearbyShopsMap.tsx` - Interactive map component

#### **Modified Files:**
1. `app/(tabs)/products.tsx` - Main products screen with filtering
2. `app/product/[id].tsx` - Product details with distance info

### **Key Functions:**

#### **Location Utilities (`utils/location.ts`):**
- `calculateDistance()` - Haversine formula for distance calculation
- `getCurrentLocation()` - Permission handling and location retrieval
- `formatDistance()` - Smart distance formatting (m/km)
- `sortByDistance()` - Generic distance-based sorting

#### **Location Features:**
- **Permission Handling**: Graceful handling of location permissions
- **Error Management**: Comprehensive error handling for location services
- **Caching**: Location-enhanced products are cached for performance
- **Fallback**: App works normally even without location access

## Data Structure

### **Shop Collection Structure:**
```javascript
{
  id: "shopId",
  name: "Shop Name",
  farmerId: "farmerId",
  location: {
    latitude: 23.7465,
    longitude: 90.3965
  }
}
```

### **Product Collection Structure:**
```javascript
{
  id: "productId",
  name: "Product Name",
  price: 100,
  image: "imageUrl",
  unit: "kg",
  shopId: "shopId",
  farmerId: "farmerId",
  type: "vegetable"
}
```

## User Experience

### **Products Screen:**
1. **Location Request**: App requests location permission on first load
2. **Filter Toggle**: Toggle switch to enable/disable location filtering
3. **Distance Selection**: Choose filtering radius (5km, 10km, 20km, 50km)
4. **Map View**: Optional map view showing all nearby shops
5. **Product Cards**: Enhanced with shop name and distance information

### **Product Detail Screen:**
1. **Distance Display**: Shows exact distance to shop
2. **Shop Information**: Comprehensive shop details including location
3. **Location Coordinates**: Precise location information

## Benefits

1. **User Convenience**: Find products from nearby shops easily
2. **Reduced Delivery Time**: Choose products from closer shops
3. **Better Experience**: Visual feedback with maps and distance indicators
4. **Performance**: Efficient caching and sorting algorithms
5. **Accessibility**: Works with or without location services

## Future Enhancements

1. **Delivery Cost Calculation**: Calculate delivery costs based on distance
2. **Route Planning**: Integration with navigation apps
3. **Shop Hours**: Show shop operating hours and status
4. **Inventory Status**: Real-time stock information
5. **Favorites**: Save favorite nearby shops
6. **Push Notifications**: Notify about new products from nearby shops

## Usage

1. Open the Products tab
2. Allow location access when prompted
3. Toggle "Filter by nearby shops" to enable location-based filtering
4. Select desired distance range (5km, 10km, 20km, 50km)
5. Optionally view shops on map by tapping "View Map"
6. Browse filtered products sorted by distance
7. Tap on any product to see detailed information including distance to shop
