import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AppNavigator from './screens/Navigation';
import ErrorBoundary from './ErrorBoundary';
import { View, ActivityIndicator, Platform } from 'react-native';
import { navigationRef } from './utils/RootNavigation';
import { Theme } from './constants/Theme';

// Show notifications in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const API_URL = 'https://gympalbackend-production.up.railway.app/api';

const GymPalTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Theme.colors.background,
    text: Theme.colors.text,
  },
};

// G2 — request permission + register Expo push token with the backend
async function registerPushToken(authToken) {
  try {
    if (!Device.isDevice) return; // push not available in emulator
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expo_push_token = tokenData.data;

    await axios.post(
      `${API_URL}/users/push-token`,
      { expo_push_token },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
  } catch (err) {
    console.warn('[push] Token registration failed:', err.message);
  }
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [initialRoute, setInitialRoute] = useState('Login');
  const [loading, setLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const role = await AsyncStorage.getItem('role');

      if (!token) throw new Error("No token");

      const response = await axios.get(`${API_URL}/users/validate-token`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200) {
        setIsAuthenticated(true);
        setUserRole(role);

        const lastRoute = await AsyncStorage.getItem('lastRoute');
        if (lastRoute) setInitialRoute(lastRoute);

        // G2 — register Expo push token
        registerPushToken(token);
      } else {
        throw new Error("Token invalid");
      }
    } catch (error) {
      console.warn("❌ Token check failed:", error.message);
      await AsyncStorage.clear();
      setIsAuthenticated(false);
      setUserRole('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();

    // G2 — handle notification tap → navigate to the screen embedded in data
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen && navigationRef.current?.isReady()) {
        navigationRef.current.navigate(screen);
      }
    });
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <NavigationContainer
        ref={navigationRef}
        theme={GymPalTheme}
        onStateChange={async (state) => {
          const currentRoute = state.routes[state.index]?.name;
          if (currentRoute) {
            await AsyncStorage.setItem('lastRoute', currentRoute);
          }
        }}
      >
        <AppNavigator
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          refreshAuth={refreshAuth}
          initialRoute={isAuthenticated ? initialRoute : 'Login'}
        />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
