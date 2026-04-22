import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import CustomButton from '../../components/CustomButton';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function TrainerHome({ navigation }) {
  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  return (
    <ScreenWrapper scrollable={true}>
      <Animated.View style={styles.headerContainer} entering={FadeInDown.duration(600)}>
         <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
         </TouchableOpacity>
      </Animated.View>

      <View style={styles.contentContainer}>
        <Animated.Text style={styles.title} entering={FadeInDown.duration(600).delay(100)}>
          Trainer Dashboard
        </Animated.Text>

        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.glassCardWrapper}>
          <BlurView intensity={50} tint="dark" style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <View style={styles.buttonContainer}>
              <CustomButton
                title="🏋️‍♂️ Workout Overview"
                onPress={() => navigation.navigate('WorkoutsMenu')}
                style={styles.actionBtn}
              />
              <CustomButton
                title="📊 Client Dashboard"
                onPress={() => navigation.navigate('TrainerDashboard')}
                style={styles.actionBtn}
              />
              <CustomButton
                title="👥 Client Overview"
                onPress={() => navigation.navigate('ClientOverview')}
                style={styles.actionBtn}
              />
              <CustomButton
                title="📺 Enter Streaming Mode"
                onPress={() => navigation.navigate('TVScreen')}
                style={styles.actionBtn}
              />
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    padding: Theme.spacing.l,
    alignItems: 'flex-end',
    width: '100%',
    zIndex: 10,
  },
  logoutBtn: {
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
    backgroundColor: 'rgba(255, 76, 76, 0.15)',
    borderRadius: Theme.borderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(255, 76, 76, 0.3)',
  },
  logoutText: {
    color: Theme.colors.error,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: Theme.spacing.xxl,
  },
  title: {
    ...Theme.typography.header,
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.xxl,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  glassCardWrapper: {
    width: '100%',
    maxWidth: 500,
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    ...Theme.shadows.glass,
  },
  glassCard: {
    padding: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    backgroundColor: 'rgba(22, 22, 22, 0.4)',
  },
  sectionTitle: {
    ...Theme.typography.title,
    marginBottom: Theme.spacing.l,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: Theme.spacing.l,
  },
  actionBtn: {
    width: '100%',
  }
});
