import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { fetchExercises, submitWorkout } from '../../utils/api';

const SERVER_URL = 'https://gympalbackend-production.up.railway.app';


const TrainingScreen = ({ navigation }) => {
  const [exercisePool, setExercisePool] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [exercises, setExercises] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // G1 — live session state
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [liveExercises, setLiveExercises] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    loadExercises();
    initSocket();
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const initSocket = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        // Register user room so trainer can target this client
        socket.emit('register_user', { userId });
        // Join client session room for exercise pushes
        socket.emit('join_client_session', { clientId: userId });
      });

      socket.on('session_started', () => {
        setLiveSessionActive(true);
        setLiveExercises([]);
      });

      socket.on('exercise_pushed', ({ exercise } = {}) => {
        if (exercise) {
          setLiveExercises((prev) => [exercise, ...prev]);
        }
      });

      socket.on('session_ended', () => {
        setLiveSessionActive(false);
      });
    } catch (err) {
      console.log('Socket init error:', err.message);
    }
  };

  const loadExercises = async () => {
    try {
      const data = await fetchExercises();
      console.log("Full Exercise Pool:", data); // 🔍 Debugging Log
      setExercisePool(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load exercises.');
    }
  };

  const handleSearch = (text) => {
    console.log("Search Query:", text);
    setSearchQuery(text);

    if (text.length > 0) {
      const filtered = exercisePool.filter((exercise) =>
        typeof exercise === "string"
          ? exercise.toLowerCase().includes(text.toLowerCase())
          : exercise.name.toLowerCase().includes(text.toLowerCase())
      );
      console.log("Filtered Results:", filtered); // 🔍 Debugging Log
      setFilteredExercises(filtered);
    } else {
      setFilteredExercises([]); // Hide list if nothing is typed
    }
  };

  const handleSelectExercise = (exercise) => {
    console.log("Exercise Selected:", exercise);
    setSelectedExercise(exercise.name || exercise); // If it's an object, use `name`
    setSearchQuery(exercise.name || exercise);
    setFilteredExercises([]); // Clear search results
  };

  const addExercise = () => {
    console.log("🔹 Adding Exercise:", { selectedExercise, sets, reps, weight });

    if (!selectedExercise || !sets || !reps) {
        Alert.alert('Error', 'Please select an exercise and fill in sets and reps.');
        return;
    }

    const newExercise = { 
        name: selectedExercise, 
        sets: parseInt(sets), 
        reps: parseInt(reps), 
        weight: weight || 'Bodyweight' 
    };

    console.log("✅ New Exercise Added:", newExercise);

    setExercises(prevExercises => [...prevExercises, newExercise]);

    setSelectedExercise('');
    setSearchQuery('');
    setSets('');
    setReps('');
    setWeight('');
};

const finishWorkout = async () => {
  if (exercises.length === 0) {
      Alert.alert('Error', 'No exercises added. Please add at least one exercise.');
      return;
  }

  setIsSubmitting(true);

  try {
      const user_id = await AsyncStorage.getItem('user_id');
      console.log("🆔 Retrieved User ID:", user_id);

      if (!user_id) {
          Alert.alert('Error', 'User ID not found');
          return;
      }

      console.log("🚀 Preparing Workout Data for Submission:");
      console.log("Exercises:", exercises);

      if (!Array.isArray(exercises) || exercises.length === 0) {
          console.error("❌ Exercises is not an array or is empty! Received:", exercises);
          throw new Error("Workout data must be an array with at least one exercise.");
      }

      const workoutData = {
          name: null,  // ✅ Auto-generated in backend
          exercises: exercises
      };

      console.log("🚀 Final Workout Data:", JSON.stringify(workoutData, null, 2));

      const response = await submitWorkout(user_id, workoutData);

      if (response) {
          console.log("✅ Workout API Response:", response);
          
          // ✅ Show a pop-up confirmation
          Alert.alert(
              "Workout Submitted ✅", 
              `Your workout "${response.name}" has been successfully logged!`,
              [{ text: "OK", onPress: () => console.log("OK Pressed") }]
          );

          setExercises([]); // ✅ Clear exercises after submission
      } else {
          Alert.alert('Error', 'Workout submission failed.');
      }
  } catch (error) {
      console.error("❌ Error submitting workout:", error);
      Alert.alert('Error', 'Failed to submit workout data.');
  } finally {
      setIsSubmitting(false);
  }
};
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* G1 — Live session banner */}
      {liveSessionActive && (
        <View style={styles.liveBanner}>
          <Text style={styles.liveBannerText}>📡 Live Session Active</Text>
        </View>
      )}

      {/* G1 — Pushed exercises from trainer */}
      {liveExercises.length > 0 && (
        <View style={styles.liveExercisesContainer}>
          <Text style={styles.liveExercisesTitle}>Exercises from trainer</Text>
          {liveExercises.map((ex, i) => (
            <Text key={i} style={styles.liveExerciseItem}>▸ {ex.name}</Text>
          ))}
        </View>
      )}

      {/* GymPal Logo */}
      <Text style={styles.title}>Training Log</Text>

      {/* Search Input for Exercises */}
      <TextInput
        style={styles.input}
        placeholder="Search for an exercise..."
        placeholderTextColor="#555"
        value={searchQuery}
        onChangeText={handleSearch}
      />

      {/* Display search results only if text is typed */}
      {searchQuery.length > 0 && filteredExercises.length > 0 && (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => (typeof item === "string" ? item : item.name)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectExercise(item)}>
              <Text style={styles.searchText}>{item.name || item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Input Fields */}
      <TextInput 
        style={styles.input} 
        placeholder="Sets" 
        placeholderTextColor="#555" 
        value={sets} 
        onChangeText={setSets} 
        keyboardType="numeric" 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Reps" 
        placeholderTextColor="#555" 
        value={reps} 
        onChangeText={setReps} 
        keyboardType="numeric" 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Weight (optional)" 
        placeholderTextColor="#555" 
        value={weight} 
        onChangeText={setWeight} 
        keyboardType="numeric" 
      />

      {/* Add Exercise Button */}
      <TouchableOpacity style={styles.button} onPress={addExercise}>
        <Text style={styles.buttonText}>➕ Add Exercise</Text>
      </TouchableOpacity>

      {/* Workout Summary */}
      <Text style={styles.subtitle}>Workout Summary</Text>
      {exercises.map((item, index) => (
        <Text key={index} style={styles.summaryText}>
          {index + 1}. {item.reps} reps x {item.sets} sets x {item.weight} kg {item.name}
        </Text>
      ))}

      {/* Finish Workout Button */}
      <TouchableOpacity 
        style={[styles.buttonFinish, isSubmitting && styles.disabledButton]} 
        onPress={finishWorkout}
        disabled={isSubmitting}  
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? 'Saving...' : '✅ Workout Finished'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, alignItems: 'center', backgroundColor: '#FFFFFF' },
  liveBanner: { width: '100%', backgroundColor: '#3274ba', borderRadius: 8, padding: 10, marginBottom: 12, alignItems: 'center' },
  liveBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  liveExercisesContainer: { width: '100%', backgroundColor: '#eef4ff', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#8ebce6' },
  liveExercisesTitle: { fontWeight: 'bold', fontSize: 14, color: '#3274ba', marginBottom: 6 },
  liveExerciseItem: { fontSize: 14, color: '#1A1A1A', marginBottom: 3 },
  logo: { width: 150, height: 80, resizeMode: 'contain', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#3274ba', marginBottom: 20 },
  input: { borderWidth: 1, padding: 12, marginVertical: 8, borderRadius: 8, width: '100%', backgroundColor: '#f8f8f8', borderColor: '#8ebce6', color: '#1A1A1A' },
  button: { width: '90%', padding: 15, backgroundColor: '#f7bf0b', borderRadius: 8, alignItems: 'center', marginTop: 15 },
  buttonFinish: { width: '90%', padding: 15, backgroundColor: '#3274ba', borderRadius: 8, alignItems: 'center', marginTop: 20 },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#1A1A1A', fontSize: 18, fontWeight: 'bold' },
  searchItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  searchText: { fontSize: 16 },
  summaryText: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginTop: 5 },
});

export default TrainingScreen;
