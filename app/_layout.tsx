import { Slot } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartProvider';
import { StatusBar } from 'react-native';
import { AppProvider } from '@/context/AppContext';

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AppProvider>
			<AuthProvider>
				<CartProvider>
					<StatusBar hidden={false} barStyle='dark-content' />
					<Slot />
				</CartProvider>
			</AuthProvider>
		</AppProvider>
	);
}
