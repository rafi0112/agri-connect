import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useAuth } from './AuthContext';

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  image?: string;
  shopId: string;
  shopName?: string;
  farmerId?: string;
  userEmail?: string; // Optional, can be used to track who added the item
  stockLimit?: boolean; // Flag to indicate if item has reached stock limit
  stockQty?: number; // Current stock quantity available
};

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number, stockQty?: number) => void;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
  removeShopItems: (shopId: string) => void;
  total: number;
  loading: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const db = getFirestore(app);

  useEffect(() => {
    const loadCart = async () => {
      if (!user) {
        console.log('CartProvider: loadCart - No user, skipping load');
        setLoading(false);
        return;
      }

      console.log('CartProvider: loadCart called for user:', user.id);

      try {
        const cartRef = doc(db, 'carts', user.id);
        const cartSnap = await getDoc(cartRef);
        
        if (cartSnap.exists()) {
          const cartData = cartSnap.data();
          console.log('CartProvider: Cart data loaded from Firestore:', cartData);
          
          // Process cart items and add necessary default values
          const processedItems = cartData.items.map((item: any) => ({
            ...item,
            shopId: item.shopId || 'unknown',
            shopName: item.shopName || 'Unknown Shop',
            farmerId: item.farmerId || 'unknown',
            stockLimit: item.stockLimit || false,
            stockQty: item.stockQty || undefined
          }));
          
          setCartItems(processedItems);
          
          // Check stock limits for all items in the cart
          processedItems.forEach(async (item: CartItem) => {
            try {
              const productRef = doc(db, 'products', item.id);
              const productSnap = await getDoc(productRef);
              
              if (productSnap.exists()) {
                const productData = productSnap.data();
                const stockQty = productData.stock || 0;
                
                // If current quantity exceeds stock, update it
                if (item.quantity > stockQty) {
                  console.log(`CartProvider: Item ${item.id} quantity (${item.quantity}) exceeds stock (${stockQty}), updating`);
                  updateQuantity(item.id, item.quantity, stockQty);
                }
              }
            } catch (error) {
              console.error(`CartProvider: Error checking stock for item ${item.id}:`, error);
            }
          });
          
          console.log('CartProvider: Cart items set successfully');
        } else {
          console.log('CartProvider: No cart document found for user');
        }
      } catch (error) {
        console.error('CartProvider: Error loading cart:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [user]);

  const saveCart = async (items: CartItem[]) => {
    if (!user) {
      console.log('CartProvider: saveCart - No user, skipping save');
      return;
    }
    
    console.log('CartProvider: saveCart called for user:', user.id);
    console.log('CartProvider: saving items:', items);
    
    try {
      const cartRef = doc(db, 'carts', user.id);
      await setDoc(cartRef, { 
        items,
        userEmail: user.email, // Include user email in the cart document
        lastUpdated: new Date()
      });
      console.log('CartProvider: Cart saved successfully to Firestore');
    } catch (error) {
      console.error('CartProvider: Error saving cart:', error);
    }
  };

  const addToCart = async (item: Omit<CartItem, 'quantity'>) => {
    console.log('CartProvider: addToCart called with:', item);
    console.log('CartProvider: current user:', user?.id);
    console.log('CartProvider: current cartItems:', cartItems.length);
    
    try {
      // Check product stock before adding to cart
      const productRef = doc(db, 'products', item.id);
      const productSnap = await getDoc(productRef);
      let stockQty = 0;
      
      if (productSnap.exists()) {
        const productData = productSnap.data();
        stockQty = productData.stock || 0;
        console.log(`CartProvider: Product ${item.id} has ${stockQty} in stock`);
      }
      
      const existingItem = cartItems.find(cartItem => cartItem.id === item.id);
      let newItems: CartItem[];
      
      if (existingItem) {
        console.log('CartProvider: Item exists, updating quantity');
        // Check if adding one more would exceed stock
        if (stockQty > 0 && existingItem.quantity >= stockQty) {
          console.log(`CartProvider: Cannot add more, at stock limit (${stockQty})`);
          // Update with current quantity but mark as at limit
          newItems = cartItems.map(cartItem =>
            cartItem.id === item.id 
              ? { ...cartItem, stockLimit: true, stockQty } 
              : cartItem
          );
        } else {
          newItems = cartItems.map(cartItem =>
            cartItem.id === item.id 
              ? { 
                  ...cartItem, 
                  quantity: cartItem.quantity + 1,
                  stockLimit: stockQty > 0 && cartItem.quantity + 1 >= stockQty,
                  stockQty: stockQty > 0 ? stockQty : undefined,
                  userEmail: user?.email // Ensure user email is included
                } 
              : cartItem
          );
        }
      } else {
        console.log('CartProvider: Adding new item to cart');
        // Set stock limit for new item if stock is known
        newItems = [...cartItems, { 
          ...item, 
          quantity: 1,
          stockLimit: stockQty > 0 && 1 >= stockQty,
          stockQty: stockQty > 0 ? stockQty : undefined,
          userEmail: user?.email // Include user email with new items
        }];
      }
      
      console.log('CartProvider: New cart items:', newItems);
      setCartItems(newItems);
      saveCart(newItems);
    } catch (error) {
      console.error('CartProvider: Error adding to cart:', error);
      
      // Fallback if stock check fails
      const existingItem = cartItems.find(cartItem => cartItem.id === item.id);
      let newItems: CartItem[];
      
      if (existingItem) {
        newItems = cartItems.map(cartItem =>
          cartItem.id === item.id 
            ? { ...cartItem, quantity: cartItem.quantity + 1, userEmail: user?.email } 
            : cartItem
        );
      } else {
        newItems = [...cartItems, { ...item, quantity: 1, userEmail: user?.email }];
      }
      
      setCartItems(newItems);
      saveCart(newItems);
    }
  };

  const removeFromCart = (id: string) => {
    const newItems = cartItems.filter(item => item.id !== id);
    setCartItems(newItems);
    saveCart(newItems);
  };

  const updateQuantity = (id: string, quantity: number, stockQty?: number) => {
    if (quantity < 1) {
      removeFromCart(id);
      return;
    }
    
    // If stock quantity is provided, check if we've reached the limit
    const stockLimitReached = stockQty !== undefined && quantity >= stockQty;
    
    const newItems = cartItems.map(item =>
      item.id === id ? { 
        ...item, 
        quantity,
        stockLimit: stockLimitReached,
        stockQty: stockQty !== undefined ? stockQty : item.stockQty
      } : item
    );
    
    setCartItems(newItems);
    saveCart(newItems);
  };

  const clearCart = () => {
    setCartItems([]);
    if (user) {
      const cartRef = doc(db, 'carts', user.id);
      setDoc(cartRef, { items: [] });
    }
  };

  const refreshCart = async () => {
    if (!user) {
      console.log('CartProvider: refreshCart - No user, skipping refresh');
      return;
    }

    console.log('CartProvider: refreshCart called for user:', user.id);
    setLoading(true);

    try {
      const cartRef = doc(db, 'carts', user.id);
      const cartSnap = await getDoc(cartRef);
      
      if (cartSnap.exists()) {
        const cartData = cartSnap.data();
        console.log('CartProvider: Cart data refreshed from Firestore:', cartData);
        
        // Process cart items with stock information
        const processedItems = cartData.items.map((item: any) => ({
          ...item,
          shopId: item.shopId || 'unknown',
          shopName: item.shopName || 'Unknown Shop',
          farmerId: item.farmerId || 'unknown',
          stockLimit: item.stockLimit || false,
          stockQty: item.stockQty || undefined
        }));
        
        setCartItems(processedItems);
        
        // Validate stock for all items in the cart
        const stockUpdates = processedItems.map(async (item: CartItem) => {
          try {
            const productRef = doc(db, 'products', item.id);
            const productSnap = await getDoc(productRef);
            
            if (productSnap.exists()) {
              const productData = productSnap.data();
              const stockQty = productData.stock || 0;
              
              // Check if quantity exceeds stock and update stockLimit
              const stockLimitReached = item.quantity >= stockQty;
              if (stockLimitReached || item.stockQty !== stockQty) {
                console.log(`CartProvider: Refreshing stock for item ${item.id}: ${stockQty} available`);
                updateQuantity(item.id, Math.min(item.quantity, stockQty), stockQty);
                return true;
              }
            }
          } catch (error) {
            console.error(`CartProvider: Error checking stock for item ${item.id}:`, error);
          }
          return false;
        });
        
        // Wait for all stock updates to complete
        await Promise.all(stockUpdates);
        
        console.log('CartProvider: Cart items refreshed successfully with stock information');
      } else {
        console.log('CartProvider: No cart document found for user during refresh');
        setCartItems([]);
      }
    } catch (error) {
      console.error('CartProvider: Error refreshing cart:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to remove all items from a specific shop
  const removeShopItems = (shopId: string) => {
    try {
      console.log('CartProvider: Removing items for shop:', shopId);
      const newItems = cartItems.filter(item => item.shopId !== shopId);
      console.log('CartProvider: Remaining items after shop removal:', newItems.length);
      setCartItems(newItems);
      saveCart(newItems);
    } catch (error) {
      console.error('CartProvider: Error removing shop items:', error);
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        total,
        loading,
        refreshCart,
        removeShopItems
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};