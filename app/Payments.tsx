import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  StatusBar, 
  Alert,
  ActivityIndicator,
  useColorScheme
} from 'react-native';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { Stack } from 'expo-router';
import { Colors } from '../constants/Colors';

// Payment method options
const PAYMENT_METHODS = [
  {
    id: 'cash_on_delivery',
    name: 'Cash on Delivery',
    description: 'Pay with cash when your order arrives',
    icon: <FontAwesome name="money" size={24} color="#4CAF50" />
  },
  {
    id: 'online_payment',
    name: 'Online Payment',
    description: 'Pay securely online via credit/debit card or mobile banking',
    icon: <FontAwesome name="credit-card" size={24} color="#2196F3" />
  },
//   {
//     id: 'bank_transfer',
//     name: 'Bank Transfer',
//     description: 'Transfer funds directly to our bank account',
//     icon: <MaterialIcons name="account-balance" size={24} color="#FF9800" />
//   }
];

export default function PaymentsScreen() {
  const { user } = useAuth();
  const db = getFirestore(app);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [loading, setLoading] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  
  useEffect(() => {
    const fetchUserPaymentMethod = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const userDocRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.paymentMethod) {
            setSelectedPaymentMethod(userData.paymentMethod);
          }
        }
      } catch (error) {
        console.error('Error fetching payment method:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserPaymentMethod();
  }, [user]);
  
  const handleSavePaymentMethod = async (methodId: string) => {
    if (!user) {
      Alert.alert('Error', 'User is not logged in.');
      return;
    }
    
    setLoading(true);
    
    try {
      const userDocRef = doc(db, 'users', user.id);
      
      await setDoc(userDocRef, {
        paymentMethod: methodId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setSelectedPaymentMethod(methodId);
      setIsPaymentModalVisible(false);
      
      Alert.alert(
        'Success', 
        'Payment method updated successfully!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving payment method:', error);
      Alert.alert('Error', 'Failed to update payment method.');
    } finally {
      setLoading(false);
    }
  };
  
  const getPaymentMethodDetails = (methodId: string) => {
    return PAYMENT_METHODS.find(method => method.id === methodId);
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <Stack.Screen
        options={{
          title: 'Payment Methods',
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textLight }]}>
            Loading payment information...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <FontAwesome name="credit-card" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Payment Method</Text>
            </View>
            
            {selectedPaymentMethod ? (
              <View style={styles.selectedMethodContainer}>
                <View style={styles.methodDetails}>
                  {getPaymentMethodDetails(selectedPaymentMethod)?.icon}
                  <View style={styles.methodTextContainer}>
                    <Text style={[styles.methodName, { color: colors.text }]}>
                      {getPaymentMethodDetails(selectedPaymentMethod)?.name}
                    </Text>
                    <Text style={[styles.methodDescription, { color: colors.textLight }]}>
                      {getPaymentMethodDetails(selectedPaymentMethod)?.description}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={[styles.changeButton, { backgroundColor: `${colors.primary}15` }]}
                  onPress={() => setIsPaymentModalVisible(true)}
                >
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                  <Text style={[styles.changeButtonText, { color: colors.primary }]}>
                    Change
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noMethodContainer}>
                <FontAwesome
                  name="credit-card"
                  size={50}
                  color={`${colors.primary}60`}
                  style={styles.noMethodIcon}
                />
                <Text style={[styles.noMethodText, { color: colors.textLight }]}>
                  No payment method selected
                </Text>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.primary }]}
                  onPress={() => setIsPaymentModalVisible(true)}
                >
                  <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.addButtonText}>Add Payment Method</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: `${colors.info}15` }]}>
            <Ionicons name="information-circle" size={24} color={colors.info} />
            <Text style={[styles.infoText, { color: colors.info }]}>
              Your selected payment method will be used as the default option when placing orders. You can change it anytime.
            </Text>
          </View>
        </ScrollView>
      )}
      
      {/* Payment Method Selection Modal */}
      <Modal
        visible={isPaymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPaymentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Payment Method</Text>
              <TouchableOpacity 
                onPress={() => setIsPaymentModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.methodsList}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodItem,
                    selectedPaymentMethod === method.id && 
                    [styles.selectedMethod, { borderColor: colors.primary }]
                  ]}
                  onPress={() => handleSavePaymentMethod(method.id)}
                >
                  <View style={styles.methodIcon}>
                    {method.icon}
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={[styles.methodName, { color: colors.text }]}>{method.name}</Text>
                    <Text style={[styles.methodDescription, { color: colors.textLight }]}>
                      {method.description}
                    </Text>
                  </View>
                  {selectedPaymentMethod === method.id && (
                    <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  selectedMethodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  methodDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  noMethodContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noMethodIcon: {
    marginBottom: 12,
  },
  noMethodText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  methodsList: {
    paddingHorizontal: 16,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedMethod: {
    borderWidth: 2,
  },
  methodIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
