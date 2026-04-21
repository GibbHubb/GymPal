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
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values'; // required for uuid in React Native
import { fetchExercises } from '../../utils/api';
import { enqueue, getPendingCount } from '../../utils/syncQueue';
import { runSync } from '../../utils/syncEngine';

const SERVER_URL = 'https://gympalbackend-production.up.railway.app';


const TrainingScreen = ({ navigation }) => {
  const [exercisePool, setExercisePool] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [exercises, setExercises] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // G3 — offline sync state
  const [syncStatus, setSyncStatus] = useState(null); // null | 'pending' | 'synced' | 'failed'
  const [pendingCount, setPendingCount] = useState(0);
  // G9 — personal best banner state
  const [personalBests, setPersonalBests] = useState([]);
  // G1 — live session state
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [liveExercises, setLiveExercises] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    loadExercises();
    initSocket();
    loadPendingCount();
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const loadPendingCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

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
    // G9 — capture exercise_id so the backend can run PB detection
    setSelectedExerciseId(exercise.exercise_id || null);
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
        exercise_id: selectedExerciseId, // G9 — needed for PB detection
        sets: parseInt(sets),
        reps: parseInt(reps),
        weight: weight || 'Bodyweight'
    };

    console.log("✅ New Exercise Added:", newExercise);

    setExercises(prevExercises => [...prevExercises, newExercise]);

    setSelectedExercise('');
    setSelectedExerciseId(null);
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
  setSyncStatus('pending');

  try {
      const user_id = await AsyncStorage.getItem('user_id');
      const authToken = await AsyncStorage.getItem('token');

      if (!user_id) {
          Alert.alert('Error', 'User ID not found');
          return;
      }

      const entryId = uuidv4();
      // G9 — payload shape matches backend POST /api/workouts (createWorkout):
      //   exercises[{ exercise_id, sets: [{weight, reps, rir}] }]
      const workoutPayload = {
          name: null,
          notes: null,
          client_id: entryId,
          exercises: exercises
            .filter((e) => e.exercise_id)
            .map((exercise) => {
                const setCount = parseInt(exercise.sets) || 1;
                const reps = parseInt(exercise.reps) || 0;
                const weight = parseFloat(exercise.weight) || 0;
                // Backend iterates `sets` array, inserting one row per set entry.
                const setArr = Array.from({ length: setCount }, () => ({ weight, reps, rir: null }));
                return { exercise_id: exercise.exercise_id, sets: setArr };
            }),
      };

      // G3 — enqueue for offline-first; always persists before attempting network
      await enqueue({ id: entryId, type: 'workout_log', payload: workoutPayload });
      await loadPendingCount();

      Alert.alert(
          'Workout Queued',
          'Your workout has been saved and will sync when online.',
          [{ text: 'OK' }]
      );
      setExercises([]);

      // Try to sync immediately if online. G9 — surface any PBs detected by server.
      try {
          const result = await runSync(SERVER_URL, authToken);
          setSyncStatus('synced');
          if (result && Array.isArray(result.personalBests) && result.personalBests.length > 0) {
              setPersonalBests(result.personalBests);
          }
      } catch {
          setSyncStatus('failed');
      }
      await loadPendingCount();
  } catch (error) {
      console.error('Error queuing workout:', error);
      setSyncStatus('failed');
      Alert.alert('Error', 'Failed to save workout data.');
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

      {/* G9 — Personal Best celebration banner */}
      {personalBests.length > 0 && (
        <View style={styles.pbBanner}>
          <Text style={styles.pbBannerTitle}>🏆 NEW PERSONAL BEST!</Text>
          {personalBests.map((pb, i) => (
            <Text key={i} style={styles.pbBannerItem}>
              {pb.exercise_name}: volume {pb.new_volume} (prev best {Math.round(pb.previous_best)})
            </Text>
          ))}
          <TouchableOpacity onPress={() => setPersonalBests([])} style={styles.pbBannerDismiss}>
            <Text style={styles.pbBannerDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* G3 — Pending sync badge */}
      {pendingCount > 0 && (
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>⏳ {pendingCount} workout{pendingCount > 1 ? 's' : ''} pending sync</Text>
        </View>
      )}
      {syncStatus === 'synced' && pendingCount === 0 && (
        <View style={[styles.syncBadge, styles.syncBadgeSynced]}>
          <Text style={styles.syncBadgeText}>✓ Synced</Text>
        </View>
      )}
      {syncStatus === 'failed' && (
        <View style={[styles.syncBadge, styles.syncBadgeFailed]}>
          <Text style={styles.syncBadgeText}>⚠ Sync failed — will retry when online</Text>
        </View>
      )}

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
  syncBadge: { width: '100%', backgroundColor: '#f7bf0b', borderRadius: 8, padding: 8, marginBottom: 8, alignItems: 'center' },
  syncBadgeSynced: { backgroundColor: '#4caf50' },
  syncBadgeFailed: { backgroundColor: '#e53935' },
  syncBadgeText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 13 },
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
  // G9 — PB banner styles
  pbBanner: {
    width: '100%',
    backgroundColor: '#ffd700',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f7bf0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pbBannerTitle: { color: '#1A1A1A', fontWeight: '900', fontSize: 16, marginBottom: 6, letterSpacing: 1 },
  pbBannerItem: { color: '#1A1A1A', fontWeight: '600', fontSize: 13, marginBottom: 2, textAlign: 'center' },
  pbBannerDismiss: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#1A1A1A', borderRadius: 6 },
  pbBannerDismissText: { color: '#ffd700', fontWeight: '700', fontSize: 12 },
});

export default TrainingScreen;
