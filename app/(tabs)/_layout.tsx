import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Redirect } from 'expo-router';
import { StatusBar } from 'react-native';
import { useApp } from '../../context/AppContext';
import SplashScreen from '@/components/SplashScreen';
import Toast from 'react-native-toast-message';
import TabBar from '@/components/TabBar';

export default function TabLayout() {
	const { isAppReady } = useApp();
	const { user } = useAuth();

	if (!isAppReady) {
		return <SplashScreen />;
	}

	if (!user) {
		return <Redirect href='/auth/login' />;
	}

	return (
		<>
			<StatusBar hidden={false} barStyle='dark-content' />
			<Tabs
				tabBar={(props) => <TabBar {...props} />}
				screenOptions={{ headerShown: false }}
			>
				<Tabs.Screen name='index' options={{ title: 'Home' }} />
				<Tabs.Screen name='products' options={{ title: 'Products' }} />
				<Tabs.Screen name='cart' options={{ title: 'Cart' }} />
				<Tabs.Screen name='orders' options={{ title: 'Orders' }} />
				<Tabs.Screen name='profile' options={{ title: 'Profile' }} />
			</Tabs>
			<Toast />
		</>
	);
}
