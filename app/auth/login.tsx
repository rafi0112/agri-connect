import { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
	Alert,
	Image,
	StyleSheet,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const { login, loading } = useAuth();

	const handleLogin = async () => {
		try {
			await login(email, password);
			router.replace('/(tabs)');
		} catch (error) {
			Alert.alert(
				'Login Failed',
				error instanceof Error ? error.message : 'An unknown error occurred'
			);
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			style={styles.container}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps='handled'
			>
				<View style={styles.logoContainer}>
					<View style={styles.appIcon}>
						<Feather name='sun' size={48} color='#fff' />
					</View>
					<Text style={styles.appName}>AgriConnect</Text>
					<Text style={styles.subtitle}>
						Login to Eating Fresh Food.
					</Text>
				</View>

				<View style={styles.inputContainer}>
					<View style={styles.inputWrapper}>
						<MaterialIcons
							name='email'
							size={20}
							color='#4CAF50'
							style={styles.inputIcon}
						/>
						<TextInput
							placeholder='Email Address'
							placeholderTextColor='#999'
							value={email}
							onChangeText={setEmail}
							style={styles.input}
							keyboardType='email-address'
							autoCapitalize='none'
						/>
					</View>

					<View style={styles.inputWrapper}>
						<Feather
							name='lock'
							size={20}
							color='#4CAF50'
							style={styles.inputIcon}
						/>
						<TextInput
							placeholder='Password'
							placeholderTextColor='#999'
							value={password}
							onChangeText={setPassword}
							style={styles.input}
							secureTextEntry={!showPassword}
						/>
						<TouchableOpacity
							onPress={() => setShowPassword(!showPassword)}
							style={styles.passwordToggle}
						>
							<Feather
								name={showPassword ? 'eye-off' : 'eye'}
								size={20}
								color='#4CAF50'
							/>
						</TouchableOpacity>
					</View>

					<TouchableOpacity
						style={styles.forgotPassword}
						onPress={() => Alert.alert('Reset password link sent')}
					>
						<Text style={styles.forgotPasswordText}>Forgot Password?</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.authButton}
						onPress={handleLogin}
						disabled={loading}
					>
						{loading ? (
							<ActivityIndicator color='#fff' />
						) : (
							<Text style={styles.authButtonText}>Sign In</Text>
						)}
					</TouchableOpacity>
				</View>

				<View style={styles.footer}>
					<Text style={styles.footerText}>Don't have an account?</Text>
					<Link href='/auth/register'>
						<Text style={styles.footerLink}> Sign Up</Text>
					</Link>
				</View>

				<View style={styles.socialAuthContainer}>
					<Text style={styles.socialAuthText}>Or sign in with</Text>
					<View style={styles.socialButtons}>
						<TouchableOpacity style={styles.socialButton}>
							<Feather name='github' size={24} color='#333' />
						</TouchableOpacity>
						<TouchableOpacity style={styles.socialButton}>
							<Feather name='twitter' size={24} color='#1DA1F2' />
						</TouchableOpacity>
						<TouchableOpacity style={styles.socialButton}>
							<Feather name='facebook' size={24} color='#4267B2' />
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f6fcf6',
		paddingHorizontal: 24,
	},
	scrollContainer: {
		flexGrow: 1,
		justifyContent: 'center',
	},
	logoContainer: {
		alignItems: 'center',
		marginBottom: 32,
	},
	appIcon: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: '#4CAF50',
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 12,
	},
	appName: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#2e7d32',
		marginBottom: 4,
	},
	title: {
		fontSize: 22,
		fontWeight: '600',
		color: '#333',
	},
	subtitle: {
		color: '#666',
		fontSize: 14,
		marginTop: 4,
	},
	inputContainer: {
		marginBottom: 24,
	},
	inputWrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#fff',
		borderRadius: 12,
		paddingHorizontal: 16,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#d9f0da',
	},
	inputIcon: {
		marginRight: 12,
	},
	input: {
		flex: 1,
		height: 56,
		color: '#333',
		fontSize: 16,
	},
	passwordToggle: {
		padding: 8,
	},
	authButton: {
		backgroundColor: '#4CAF50',
		borderRadius: 12,
		height: 56,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 8,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	authButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	forgotPassword: {
		alignSelf: 'flex-end',
		marginTop: 8,
	},
	forgotPasswordText: {
		color: '#4CAF50',
		fontSize: 14,
	},
	footer: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginBottom: 24,
	},
	footerText: {
		color: '#666',
		fontSize: 14,
	},
	footerLink: {
		color: '#4CAF50',
		fontSize: 14,
		fontWeight: '600',
	},
	socialAuthContainer: {
		alignItems: 'center',
	},
	socialAuthText: {
		color: '#666',
		fontSize: 14,
		marginBottom: 16,
	},
	socialButtons: {
		flexDirection: 'row',
		justifyContent: 'center',
	},
	socialButton: {
		backgroundColor: '#fff',
		borderRadius: 12,
		width: 56,
		height: 56,
		justifyContent: 'center',
		alignItems: 'center',
		marginHorizontal: 8,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		borderWidth: 1,
		borderColor: '#d9f0da',
	},
});
