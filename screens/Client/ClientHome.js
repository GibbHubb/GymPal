import React from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';
import CustomButton from '../../components/CustomButton';
import ScreenWrapper from '../../components/ScreenWrapper';


const ClientHome = ({ navigation }) => {
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
          <CustomButton 
            title="💪 Training" 
            onPress={() => navigation.navigate('TrainingScreen')} 
            style={styles.actionBtn} 
          />
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
  }
});

export default ClientHome;
