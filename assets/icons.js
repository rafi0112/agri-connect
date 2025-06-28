import { AntDesign, Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';

export const icons = {
  index: (props) => <Ionicons name='home-outline' size={26} {...props} />,
  products: (props) => <MaterialIcons name='fastfood' size={26} {...props} />,
  cart: (props) => <Ionicons name='cart-outline' size={26} {...props} />,
  orders: (props) => <Ionicons name='receipt-outline' size={26} {...props} />,
  profile: (props) => <Ionicons name='person-outline' size={26} {...props} />,
};
