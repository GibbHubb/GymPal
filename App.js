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
import { runSync } from './utils/syncEngine';
import { API_URL, SERVER_URL } from './config/api';  // G54
import { authApi, SessionExpiredError } from './api';  // G47
import { getTokens, clearSession } from './utils/session';  // G47

// Show notifications in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


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

  // G47 — cold start / post-login auth check.
  // It used to GET /users/validate-token, a route that does not exist: since G55 guarded
  // /users/:user_id that path 400s, so every check failed and ran AsyncStorage.clear(),
  // logging the user out and deleting the offline workout queue. Now: ask /users/me through
  // the refresh-aware client (an expired access token is refreshed transparently), log out
  // only when the SESSION is rejected, and stay signed in when the server is merely
  // unreachable, so an offline cold start keeps the user's session and queue.
  const refreshAuth = async () => {
    try {
      const { token, refreshToken } = await getTokens();
      const role = await AsyncStorage.getItem('role');

      if (!token && !refreshToken) throw new SessionExpiredError('No session');

      try {
        await authApi.get('/users/me');
      } catch (err) {
        const status = err?.response?.status;
        if (err instanceof SessionExpiredError || (status >= 400 && status < 500)) throw err;
        console.warn('⚠️ Auth check could not reach the server; keeping the stored session.');
      }

      setIsAuthenticated(true);
      setUserRole(role);

      const lastRoute = await AsyncStorage.getItem('lastRoute');
      if (lastRoute) setInitialRoute(lastRoute);

      // G2 — register Expo push token
      const current = await getTokens();
      if (current.token) registerPushToken(current.token);
    } catch (error) {
      console.warn("❌ Token check failed:", error.message);
      await clearSession();  // session keys only; the offline queue survives
      setIsAuthenticated(false);
      setUserRole('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();

    // G3 — start offline sync engine
    // NetInfo events are synchronous callbacks, but AsyncStorage is async.
    // We bridge this by triggering an async runSync directly from the listener
    // rather than relying on getAuthToken() returning a value synchronously.
    const API_BASE = SERVER_URL;
    const { default: NetInfo } = require('@react-native-community/netinfo');
    const syncOnConnect = async (state) => {
      if (state.isConnected) {
        const token = await AsyncStorage.getItem('token');
        if (token) runSync(API_BASE, token).catch(() => {});
      }
    };
    const netInfoUnsub = NetInfo.addEventListener(syncOnConnect);

    // Also attempt an immediate sync on mount
    AsyncStorage.getItem('token').then(token => {
      if (token) runSync(API_BASE, token).catch(() => {});
    });

    // G2 — handle notification tap → navigate to the screen embedded in data
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen && navigationRef.current?.isReady()) {
        navigationRef.current.navigate(screen);
      }
    });
    return () => {
      sub.remove();
      netInfoUnsub();
    };
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
