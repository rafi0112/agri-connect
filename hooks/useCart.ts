// import { useState, useContext, createContext, ReactNode } from 'react';

// interface CartItem {
//   id: number;
//   name: string;
//   quantity: number;
// }

// interface CartContextType {
//   cartItems: CartItem[];
//   addToCart: (item: CartItem) => void;
//   removeFromCart: (id: number) => void;
//   clearCart: () => void;
// }

// const CartContext = createContext<CartContextType | undefined>(undefined);

// export const CartProvider = ({ children }: { children: ReactNode }) => {
//   const [cartItems, setCartItems] = useState<CartItem[]>([]);

//   const addToCart = (item: CartItem) => {
//     setCartItems((prevItems) => {
//       const existingItem = prevItems.find((i) => i.id === item.id);
//       if (existingItem) {
//         return prevItems.map((i) =>
//           i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
//         );
//       }
//       return [...prevItems, item];
//     });
//   };

//   const removeFromCart = (id: number) => {
//     setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
//   };

//   const clearCart = () => {
//     setCartItems([]);
//   };

//   return (
//     <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart }}>
//       {children}
//     </CartContext.Provider>
//   );
// };

// export const useCart = (): CartContextType => {
//   const context = useContext(CartContext);
//   if (!context) {
//     throw new Error('useCart must be used within a CartProvider');
//   }
//   return context;
// };