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
};

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
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
          
          setCartItems(cartData.items.map((item: any) => ({
            ...item,
            shopId: item.shopId || 'unknown',
            shopName: item.shopName || 'Unknown Shop',
            farmerId: item.farmerId || 'unknown'
          })));
          
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
      await setDoc(cartRef, { items });
      console.log('CartProvider: Cart saved successfully to Firestore');
    } catch (error) {
      console.error('CartProvider: Error saving cart:', error);
    }
  };

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    console.log('CartProvider: addToCart called with:', item);
    console.log('CartProvider: current user:', user?.id);
    console.log('CartProvider: current cartItems:', cartItems.length);
    
    const existingItem = cartItems.find(cartItem => cartItem.id === item.id);
    let newItems: CartItem[];
    
    if (existingItem) {
      console.log('CartProvider: Item exists, updating quantity');
      newItems = cartItems.map(cartItem =>
        cartItem.id === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 } 
          : cartItem
      );
    } else {
      console.log('CartProvider: Adding new item to cart');
      newItems = [...cartItems, { ...item, quantity: 1 }];
    }
    
    console.log('CartProvider: New cart items:', newItems);
    setCartItems(newItems);
    saveCart(newItems);
  };

  const removeFromCart = (id: string) => {
    const newItems = cartItems.filter(item => item.id !== id);
    setCartItems(newItems);
    saveCart(newItems);
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(id);
      return;
    }
    
    const newItems = cartItems.map(item =>
      item.id === id ? { ...item, quantity } : item
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
        loading
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