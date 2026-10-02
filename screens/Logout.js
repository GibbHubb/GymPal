import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { clearSession } from '../utils/session';  // G47

export default function LogoutScreen({ navigation, refreshAuth }) {
    const handleLogout = async () => {
        console.log("🚪 Logging out...");
        await clearSession();  // G47 — session keys only; the offline queue survives
      
        console.log("🔄 Refreshing auth state...");
        if (refreshAuth) await refreshAuth();  // ✅ Ensure auth state updates immediately
      
        console.log("🔀 Resetting navigation...");
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],  // ✅ Ensure it resets to Login
          })
        );
      };
      
      
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Are you sure you want to log out?</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, marginBottom: 20 },
  button: { backgroundColor: '#F6B000', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
