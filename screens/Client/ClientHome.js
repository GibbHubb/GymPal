import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';
import CustomButton from '../../components/CustomButton';
import ScreenWrapper from '../../components/ScreenWrapper';
import { getPendingCount } from '../../utils/syncQueue';


const ClientHome = ({ navigation }) => {
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      const count = await getPendingCount();
      setPendingSyncCount(count);
    };
    loadCount();
    // Refresh count when screen comes back into focus
    const unsubscribe = navigation.addListener('focus', loadCount);
    return unsubscribe;
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert('Logged Out', 'You have been logged out.');
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  return (
    <ScreenWrapper>
      {/* Logout Header */}
      <View style={styles.headerContainer}>
         <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
         </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* GymPal Logo */}
        <Text style={styles.title}>Welcome Back!</Text>

        <View style={styles.buttonContainer}>
          <CustomButton 
            title="📋 Intake" 
            onPress={() => navigation.navigate('IntakeScreen')} 
            style={styles.actionBtn} 
          />
          <CustomButton 
            title="🌿 Lifestyle" 
            onPress={() => navigation.navigate('LifestyleScreen')} 
            style={styles.actionBtn} 
          />
          <View style={styles.trainingBtnWrapper}>
            <CustomButton
              title="💪 Training"
              onPress={() => navigation.navigate('TrainingScreen')}
              style={styles.actionBtn}
            />
            {pendingSyncCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingSyncCount}</Text>
              </View>
            )}
          </View>
          <CustomButton 
            title="📊 Progress" 
            onPress={() => navigation.navigate('ProgressScreen')} 
            style={styles.actionBtn} 
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    padding: Theme.spacing.m,
    alignItems: 'flex-end',
    width: '100%',
  },
  logoutBtn: {
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  logoutText: {
    color: Theme.colors.error,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.l,
  },
  logo: {
    width: 200,
    height: 100,
    resizeMode: 'contain',
    marginBottom: Theme.spacing.xl,
    tintColor: Theme.colors.primary, // Optional: if you want the logo to adapt to the gold theme
  },
  title: {
    ...Theme.typography.header,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: Theme.spacing.m, // Uses gap for modern layout spacing
  },
  actionBtn: {
    width: '100%',
  },
  trainingBtnWrapper: {
    position: 'relative',
    width: '100%',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default ClientHome;
