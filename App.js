import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AppNavigator from './screens/Navigation';
import ErrorBoundary from './ErrorBoundary';
import { View, ActivityIndicator, Platform, AppState } from 'react-native';
import { navigationRef } from './utils/RootNavigation';
import { Theme } from './constants/Theme';
import { syncQueued } from './utils/sessionSync';  // G48
import { SERVER_URL } from './config/api';  // G54
import { authApi, SessionExpiredError, refreshSession } from './api';  // G47
import { getTokens, clearSession } from './utils/session';  // G47
import { checkSession } from './utils/authCheck';  // G47 review

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
async function registerPushToken() {
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

    await authApi.post('/users/push-token', { expo_push_token });  // G47 review — refresh-aware
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
  // The decision lives in utils/authCheck.js (tested).
  const refreshAuth = async () => {
    try {
      const role = await AsyncStorage.getItem('role');
      const verdict = await checkSession({ getTokens, fetchMe: () => authApi.get('/users/me') });
      if (verdict === 'signed-out') throw new SessionExpiredError('Session rejected');
      if (verdict === 'unverified') {
        console.warn('⚠️ Auth check could not reach the server; keeping the stored session.');
      }

      setIsAuthenticated(true);
      setUserRole(role);

      const lastRoute = await AsyncStorage.getItem('lastRoute');
      if (lastRoute) setInitialRoute(lastRoute);

      // G2 — register Expo push token
      const current = await getTokens();
      if (current.token) registerPushToken();

      // G48 — cold start and login: an EXPLICIT sync (also retries items that exhausted
      // their automatic attempts), with a refreshed token if the stored one has expired.
      syncQueued(SERVER_URL, refreshSession, { explicit: true }).catch(() => {});
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

    // G3 — start offline sync engine. G48: every trigger goes through syncQueued, which
    // refreshes an expired token instead of sending the stale stored one. (The mount-time
    // sync that sent the raw stored token is gone: refreshAuth's explicit sync replaces it.)
    const { default: NetInfo } = require('@react-native-community/netinfo');
    const netInfoUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncQueued(SERVER_URL, refreshSession).catch(() => {});
    });

    // G48 — back to the foreground: an explicit sync, so a sync does not depend on a
    // connectivity edge (the common case is an app reopened while already online).
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') syncQueued(SERVER_URL, refreshSession, { explicit: true }).catch(() => {});
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
      appStateSub.remove();
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
