import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';

export default function PaymentFail() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('Payment failed params:', params);
    
    // Show alert and redirect after 3 seconds
    setTimeout(() => {
      Alert.alert(
        'Payment Failed',
        'Your payment could not be processed. Please try again or contact support.',
        [
          {
            text: 'Try Again',
            onPress: () => router.replace('/(tabs)/cart')
          },
          {
            text: 'Go to Orders',
            onPress: () => router.replace('/(tabs)/orders')
          }
        ]
      );
    }, 1000);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorMark}>✗</Text>
        </View>
        <ThemedText style={[styles.title, styles.errorTitle]}>Payment Failed</ThemedText>
        <ThemedText style={styles.message}>
          Unfortunately, your payment could not be processed. Please try again.
        </ThemedText>
        {params.failedreason && (
          <ThemedText style={styles.reason}>
            Reason: {params.failedreason}
          </ThemedText>
        )}
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
  errorTitle: {
    color: '#f44336',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  reason: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
    marginTop: 10,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorMark: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
});
