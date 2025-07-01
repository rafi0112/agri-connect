import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import React from 'react';
import { AntDesign, Feather } from '@expo/vector-icons';
import TabBarButton from './TabBarButton';
import { Colors } from '../constants/Colors';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];
	
	return (
		<View style={[styles.tabbar, {
			backgroundColor: colors.tabBar,
			shadowColor: colors.shadowColor,
			borderColor: colors.border,
		}]}>
			{state.routes.map((route, index) => {
				const { options } = descriptors[route.key];
				const label =
					options.tabBarLabel !== undefined
						? options.tabBarLabel
						: options.title !== undefined
						? options.title
						: route.name;

				if (['_sitemap', '+not-found'].includes(route.name)) return null;

				const isFocused = state.index === index;

				const onPress = () => {
					const event = navigation.emit({
						type: 'tabPress',
						target: route.key,
						canPreventDefault: true,
					});

					if (!isFocused && !event.defaultPrevented) {
						navigation.navigate(route.name, route.params);
					}
				};

				const onLongPress = () => {
					navigation.emit({
						type: 'tabLongPress',
						target: route.key,
					});
				};

				return (
					<TabBarButton
						key={route.name}
						style={styles.tabbarItem}
						onPress={onPress}
						onLongPress={onLongPress}
						isFocused={isFocused}
						routeName={
							route.name as 'index' | 'products' | 'cart' | 'orders' | 'profile'
						}
						color={isFocused ? colors.primary : colors.tabIconDefault}
						label={typeof label === 'string' ? label : ''}
					/>
				);
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	tabbar: {
		position: 'absolute',
		bottom: 25,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginHorizontal: 20,
		paddingVertical: 15,
		borderRadius: 30,
		borderCurve: 'continuous',
		borderWidth: 0.5,
		shadowOffset: { width: 0, height: 4 },
		shadowRadius: 15,
		shadowOpacity: 0.2,
		elevation: 5,
	},
	tabbarItem: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
});

export default TabBar;
