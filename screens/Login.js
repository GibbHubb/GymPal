import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ImageBackground,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../utils/api';
import { Theme } from '../constants/Theme';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';

const backgroundImage = require('../imgs/BG.png'); // Ensure the correct path

export default function LoginScreen({ navigation, refreshAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const response = await loginUser({ username, password });
  
      if (response.token) {
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('role', response.role);
  
        await refreshAuth();
  
        navigation.reset({
          index: 0,
          routes: [{ name: response.role === 'client' || response.role === 'user' ? 'ClientHome' : 'TrainerHome' }]
        });
      } else {
        Alert.alert("Login error", "No token received.");
      }
    } catch (error) {
      Alert.alert("Login failed", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ImageBackground source={backgroundImage} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <View style={styles.contentContainer}>
          <Text style={styles.header}>GymPal</Text>
          <Text style={styles.subtext}>Welcome back. Ascend to new heights.</Text>

          <View style={styles.formContainer}>
            <CustomInput
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <CustomInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <CustomButton 
              title="Login"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: Theme.colors.transparentDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.l,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: Theme.colors.transparentLight,
    padding: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.l,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  header: {
    ...Theme.typography.header,
    fontSize: 42,
    letterSpacing: 2,
    marginBottom: Theme.spacing.s,
    textTransform: 'uppercase',
  },
  subtext: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  loginBtn: {
    marginTop: Theme.spacing.m,
  }
});
