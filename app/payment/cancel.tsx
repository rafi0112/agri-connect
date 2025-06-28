import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';

export default function PaymentCancel() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('Payment cancelled params:', params);
    
    // Show alert and redirect after 2 seconds
    setTimeout(() => {
      Alert.alert(
        'Payment Cancelled',
        'You have cancelled the payment process.',
        [
          {
            text: 'Return to Cart',
            onPress: () => router.replace('/(tabs)/cart')
          },
          {
            text: 'Continue Shopping',
            onPress: () => router.replace('/(tabs)/products')
          }
        ]
      );
    }, 1000);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.cancelIcon}>
          <Text style={styles.cancelMark}>!</Text>
        </View>
        <ThemedText style={[styles.title, styles.cancelTitle]}>Payment Cancelled</ThemedText>
        <ThemedText style={styles.message}>
          You have cancelled the payment process. Your cart items are still saved.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  cancelTitle: {
    color: '#ff9800',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  cancelIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelMark: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
});
