import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserById, updateUser } from '../../utils/api';

export default function ProfileScreen({ route, navigation }) {
  const { userId: routeUserId } = route.params || {}; // ✅ Get user ID from navigation if available
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // User fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // ✅ Get user ID from AsyncStorage if not passed via route
      let storedUserId = routeUserId || await AsyncStorage.getItem('user_id');
      if (!storedUserId) throw new Error('❌ Error: User ID not found in AsyncStorage or navigation params');

      setUserId(storedUserId);
      console.log(`📡 Fetching client data for ID: ${storedUserId}`);

      // ✅ Fetch user data from API
      const data = await fetchUserById(storedUserId);

      // ✅ Check if data is valid
      if (!data) {
        console.warn(`⚠️ Warning: No data received for user ID ${storedUserId}`);
        Alert.alert("Warning", "No user data found. The user might not exist.");
        return;
      }

      console.log("✅ Client data received:", data);

      // ✅ Prefill form fields only if data is available
      setUserData(data);
      setName(data.username || '');
      setAge(data.age?.toString() || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setGender(data.gender || '');
      setWeight(data.weight?.toString() || '');
      setHeight(data.height?.toString() || '');
      setGoal(data.fitnessGoal || '');

    } catch (error) {
      console.error('❌ Error fetching user:', error);
      Alert.alert("Error", "Could not fetch user data. Please try again later.");
    } finally {
      setLoading(false);
    }
};


  const handleSave = async () => {
    try {
      console.log("📤 Sending update request:", { userId, name, age, email, phone, gender, weight, height, goal, password });
      await updateUser(userId, { username: name, age, email, phone, gender, weight, height, fitnessGoal: goal, password });
      Alert.alert("Success", "User updated successfully!");
      navigation.goBack(); // ✅ Return to previous screen
    } catch (error) {
      console.error('❌ Error updating user:', error);
      Alert.alert("Error", "Failed to update user.");
    }
  };

  if (loading) {
    return <Text style={styles.loading}>Loading...</Text>;
  }

  return (
    <View style={styles.container}>

      {/* 🔙 Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Edit Client Info</Text>

      <TextInput style={styles.input} placeholder="Client Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Age" keyboardType="numeric" value={age} onChangeText={setAge} />
      <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Gender" value={gender} onChangeText={setGender} />
      <TextInput style={styles.input} placeholder="Weight (kg)" keyboardType="numeric" value={weight} onChangeText={setWeight} />
      <TextInput style={styles.input} placeholder="Height (cm)" keyboardType="numeric" value={height} onChangeText={setHeight} />
      <TextInput style={styles.input} placeholder="Fitness Goal" value={goal} onChangeText={setGoal} />
      <TextInput style={styles.input} placeholder="New Password (optional)" secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#3274ba' },
  backButton: { alignSelf: 'flex-start', marginBottom: 10, padding: 10 },
  backButtonText: { fontSize: 18, color: '#3274ba' },
  input: { width: '90%', padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 16 },
  saveButton: { backgroundColor: '#32a852', padding: 15, borderRadius: 8, width: '90%', alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  loading: { fontSize: 18, marginTop: 20 },
});
