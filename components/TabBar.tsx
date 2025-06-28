import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import React from 'react';
import { AntDesign, Feather } from '@expo/vector-icons';
import TabBarButton from './TabBarButton';

import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
	const primaryColor = '#50C878';
	const greyColor = '#737373';
	return (
		<View style={styles.tabbar}>
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
						color={isFocused ? primaryColor : greyColor}
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
		backgroundColor: '#f0f4f8', // Match the home page background color
		marginHorizontal: 20,
		paddingVertical: 15,
		borderRadius: 25,
		borderCurve: 'continuous',
		shadowColor: 'black',
		shadowOffset: { width: 0, height: 10 },
		shadowRadius: 10,
		shadowOpacity: 0.1,
	},
	tabbarItem: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
});

export default TabBar;
