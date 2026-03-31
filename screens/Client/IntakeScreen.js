import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchIntakeData, submitIntakeData } from '../../utils/api';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';

const IntakeScreen = ({ navigation }) => {
  const [intakeData, setIntakeData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  
  useEffect(() => {
    const loadIntakeData = async () => {
      try {
        const user_id = await AsyncStorage.getItem('user_id');
        if (!user_id) {
          Alert.alert('Error', 'User ID not found');
          return;
        }
  
        const data = await fetchIntakeData(user_id);
  
        if (data && Object.keys(data).length > 0) {
          setIntakeData({ ...data, client_name: data.client_name || "" });
          setSubmitted(Object.values(data).every(value => value !== null && value !== ''));
        }
      } catch (error) {
        Alert.alert('Error', 'Could not load intake data.');
      }
    };
  
    loadIntakeData();
  }, []);
  
  const handleChange = (key, value) => {
    if (!submitted) {
      setIntakeData({ ...intakeData, [key]: value });
    }
  };

  const calculateBMI = () => {
    const heightMeters = intakeData.height_cm / 100;
    if (intakeData.weight_category && intakeData.height_cm) {
      return (intakeData.weight_category / (heightMeters * heightMeters)).toFixed(2);
    }
    return '';
  };

  const validateFields = () => {
    return Object.values(intakeData).every(value => value !== null && value !== '');
  };
  
  const submitIntake = async () => {
    if (!validateFields()) {
      Alert.alert('Error', 'Please fill in all fields before submitting.');
      return;
    }

    try {
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) {
        throw new Error('User ID not found. Please log in again.');
      }

      const intakePayload = {
        ...intakeData,
        user_id,
        client_name: intakeData.client_name || "",
        bmi: calculateBMI(),
      };

      await submitIntakeData(intakePayload);
      Alert.alert('Success', 'Intake data submitted successfully!');
      setSubmitted(true);
    } catch (error) {
      Alert.alert('Error', error.message || 'Submission failed. Please try again.');
    }
  };

  return (
    <ScreenWrapper scrollable>
      <View style={styles.topContainer}>
        <CustomButton
          title="← Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          textStyle={styles.backButtonText}
        />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>
          {submitted
            ? `Client: ${intakeData.client_name || "Unknown"} (Completed ✅)`
            : "Client Intake"}
        </Text>

        {Object.entries({
          client_name: 'Enter Client Name',
          sex: '1 = Female, 2 = Male',
          age: '1-5 Age Group',
          fat_percentage: 'Fat Percentage (1-5)',
          height_cm: 'Height in cm',
          weight_category: 'Weight Category (1-5)',
          ffmi: 'FFMI (1-5)',
          athleticism_score: 'Athleticism (1-5)',
          movement_shoulder: 'Shoulder Mobility (1-5)',
          movement_hips: 'Hip Mobility (1-5)',
          movement_ankles: 'Ankle Mobility (1-5)',
          movement_thoracic: 'Thoracic Mobility (1-5)',
          genetics: 'Genetics (1-5)',
        }).map(([key, description]) => (
          <View key={key} style={styles.inputContainer}>
            <Text style={styles.label}>{description}</Text>
            <CustomInput
              placeholder={key.replace('_', ' ')}
              value={String(intakeData[key] || "")}
              onChangeText={(value) => handleChange(key, value)}
              keyboardType={key === 'client_name' ? 'default' : 'numeric'}
              editable={!submitted}
              style={submitted ? styles.inputDisabled : null}
            />
          </View>
        ))}

        <View style={styles.bmiContainer}>
          <Text style={styles.labelMuted}>BMI (Auto Calculated)</Text>
          <Text style={styles.bmiValue}>{calculateBMI() || "--"}</Text>
        </View>

        {!submitted && (
          <CustomButton 
            title="Submit Intake"
            onPress={submitIntake}
            style={styles.submitBtn}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    paddingHorizontal: Theme.spacing.l,
    paddingTop: Theme.spacing.l,
    alignItems: 'flex-start',
    width: '100%',
  },
  backButton: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  contentContainer: {
    padding: Theme.spacing.l,
    alignItems: 'center',
    paddingBottom: Theme.spacing.xxl,
  },
  logo: {
    width: 150,
    height: 80,
    resizeMode: 'contain',
    marginBottom: Theme.spacing.l,
    tintColor: Theme.colors.primary,
  },
  title: {
    ...Theme.typography.header,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: Theme.spacing.s,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.s,
    textTransform: 'uppercase',
  },
  labelMuted: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.s,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  bmiContainer: {
    width: '100%',
    alignItems: 'center',
    padding: Theme.spacing.l,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: Theme.spacing.l,
  },
  bmiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  submitBtn: {
    width: '100%',
    marginTop: Theme.spacing.l,
  }
});

export default IntakeScreen;
