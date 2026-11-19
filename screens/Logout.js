import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { clearSession } from '../utils/session';  // G47
import { Theme } from '../constants/Theme';  // G53

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
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // G53 — the text had no colour (black on the #050505 nav background, 1.0:1) and the button
  // was white on gold (1.9:1). Both now come from the theme: onPrimary on gold is 10.3:1.
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },
  text: { fontSize: 18, marginBottom: 20, color: Theme.colors.text },
  button: { backgroundColor: Theme.colors.primary, padding: 12, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  buttonText: { color: Theme.colors.onPrimary, fontWeight: 'bold' },
});
