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
  ScrollView,
  Vibration,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values'; // required for uuid in React Native
import { fetchExercises, createTemplate } from '../../api';
import { enqueue, getPendingCount } from '../../utils/syncQueue';
import { runSync } from '../../utils/syncEngine';
// G14 — between-batch rest timer
import { useRestTimer } from '../../hooks/useRestTimer';
import RestTimer from '../../components/RestTimer';
// G34 — client-side per-exercise PR detection (1RM + volume)
import { computePersonalRecords } from '../../hooks/usePersonalRecords';

const SERVER_URL = 'https://gympalbackend-production.up.railway.app';


const TrainingScreen = ({ navigation, route }) => {
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
  // G34 — client-computed per-exercise PR banner state (1RM + volume)
  const [exercisePRs, setExercisePRs] = useState([]);
  // G33 — save-as-template modal state
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
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

  // G32 — Repeat-last / template prefill. ClientHome navigates here with
  // { prefill: <GET /api/workouts/last payload> }, shaped
  //   { name, exercises:[{ exercise_id, name, sets:[{reps,weight,rir}] }] }.
  // Collapse each exercise's nested set-blueprint into this screen's flat
  // model ({ name, exercise_id, sets:<count>, reps, weight }) and seed the
  // summary once per navigation. Weights come straight from the /last
  // payload (the per-exercise endpoint is group-workout-scoped — see plan §8).
  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    const prefill = route?.params?.prefill;
    if (!prefill?.exercises?.length) return; // no/empty prefill → leave form empty
    const mapped = prefill.exercises.map((ex) => ({
      name: ex.name,
      exercise_id: ex.exercise_id,
      sets: Math.max(1, ex.sets?.length || 1),
      reps: ex.sets?.[0]?.reps ?? 0,
      weight: ex.sets?.[0]?.weight || 'Bodyweight',
    }));
    setExercises(mapped);
    prefillAppliedRef.current = true;
  }, [route?.params?.prefill]);

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
    // G13 — capture per-exercise rest default so G14's timer fires for the
    // right duration; falls back to the global 90s when picking from a
    // stale row that pre-dates the library hardening.
    setSelectedExerciseRest(
      typeof exercise.default_rest_seconds === 'number' && exercise.default_rest_seconds > 0
        ? exercise.default_rest_seconds
        : 90
    );
    setSearchQuery(exercise.name || exercise);
    setFilteredExercises([]); // Clear search results
  };

  // G14 — rest-timer state. Foreground-only countdown; vibrates briefly
  // at zero. Default duration sourced from the picked exercise (G13);
  // falls back to 90s for free-text picks.
  const restTimer = useRestTimer();
  const [selectedExerciseRest, setSelectedExerciseRest] = useState(90);

  // Vibrate exactly once on the fire-edge (justFired flips back to false
  // on dismiss or next start).
  useEffect(() => {
    if (restTimer.justFired) {
      try { Vibration.vibrate([0, 120, 60, 200]); } catch { /* device may not support */ }
    }
  }, [restTimer.justFired]);

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

    // Capture rest seconds BEFORE clearing the picker state below.
    const restForThisSet = selectedExerciseRest;

    setSelectedExercise('');
    setSelectedExerciseId(null);
    setSelectedExerciseRest(90);
    setSearchQuery('');
    setSets('');
    setReps('');
    setWeight('');

    // G14 — kick off the between-batch rest timer (G13 — per-exercise duration)
    restTimer.start(restForThisSet);
};

// G33 — serialise the current flat exercises into the canonical template
// shape (== the /api/workouts/last payload G32 consumes), so a saved
// template starts via the exact same prefill path.
const handleSaveTemplate = async () => {
  const name = templateName.trim();
  if (!name) {
    Alert.alert('Error', 'Please enter a template name.');
    return;
  }
  if (exercises.length === 0) {
    Alert.alert('Error', 'Add at least one exercise before saving a template.');
    return;
  }
  const payloadExercises = exercises
    .filter((e) => e.exercise_id)
    .map((e) => ({
      exercise_id: e.exercise_id,
      name: e.name,
      sets: Array.from({ length: parseInt(e.sets) || 1 }, () => ({
        reps: parseInt(e.reps) || 0,
        weight: parseFloat(e.weight) || 0,
        rir: null,
      })),
    }));
  if (payloadExercises.length === 0) {
    Alert.alert('Error', 'Templates need exercises picked from the library (so they can be repeated).');
    return;
  }
  setSavingTemplate(true);
  try {
    await createTemplate(name, payloadExercises);
    setShowSaveTemplate(false);
    setTemplateName('');
    Alert.alert('Saved', `Template "${name}" saved. Find it on your home screen.`);
  } catch (err) {
    Alert.alert('Error', 'Failed to save template.');
  } finally {
    setSavingTemplate(false);
  }
};

const finishWorkout = async () => {
  if (exercises.length === 0) {
      Alert.alert('Error', 'No exercises added. Please add at least one exercise.');
      return;
  }

  // G34 — snapshot the finished session BEFORE state is cleared, so PRs can
  // be computed against server history that does not yet include this session.
  const finishedSnapshot = exercises.slice();

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

      // G34 — compute client-side PRs from the snapshot vs the user's prior
      // history. Done BEFORE runSync so this session isn't compared to itself.
      // Best-effort: a failure here never blocks finishing/queuing.
      try {
          const prs = await computePersonalRecords(finishedSnapshot);
          if (prs.length > 0) setExercisePRs(prs);
      } catch { /* PR detection is best-effort */ }

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
      {/* G14 — Rest timer overlay (foreground-only, fires after Add Exercise) */}
      {restTimer.isActive && (
        <RestTimer
          remaining={restTimer.remaining}
          totalSeconds={restTimer.totalSeconds}
          justFired={restTimer.justFired}
          onAdjust={restTimer.adjust}
          onSkip={restTimer.skip}
          onDismiss={restTimer.dismiss}
        />
      )}

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

      {/* G34 — per-exercise PR banner (client-computed: estimated-1RM + volume) */}
      {exercisePRs.length > 0 && (
        <View style={styles.prBanner}>
          <Text style={styles.prBannerTitle}>💥 PERSONAL RECORDS</Text>
          {exercisePRs.map((pr, i) => (
            <Text key={i} style={styles.prBannerItem}>
              {pr.type === '1rm' ? '🏆 1RM' : '📈 Volume'} PR · {pr.exercise_name}: {pr.value}
              {pr.type === '1rm' ? ' kg' : ''} (prev {pr.previous}{pr.type === '1rm' ? ' kg' : ''})
            </Text>
          ))}
          <TouchableOpacity onPress={() => setExercisePRs([])} style={styles.pbBannerDismiss}>
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

      {/* G33 — Save the current exercises as a reusable named template */}
      {exercises.length > 0 && (
        <TouchableOpacity style={styles.buttonTemplate} onPress={() => setShowSaveTemplate(true)}>
          <Text style={styles.buttonText}>💾 Save as template</Text>
        </TouchableOpacity>
      )}

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

      {/* G33 — name-entry modal (cross-platform; Alert.prompt is iOS-only) */}
      <Modal
        visible={showSaveTemplate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveTemplate(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save as template</Text>
            <TextInput
              style={styles.input}
              placeholder="Template name (e.g. Push Day A)"
              placeholderTextColor="#555"
              value={templateName}
              onChangeText={setTemplateName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                disabled={savingTemplate}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, savingTemplate && styles.disabledButton]}
                onPress={handleSaveTemplate}
                disabled={savingTemplate}
              >
                <Text style={styles.buttonText}>{savingTemplate ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  buttonTemplate: { width: '90%', padding: 15, backgroundColor: '#8ebce6', borderRadius: 8, alignItems: 'center', marginTop: 15 },
  disabledButton: { backgroundColor: '#ccc' },
  // G33 — save-as-template modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#3274ba', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#eee', alignItems: 'center' },
  modalCancelText: { color: '#1A1A1A', fontSize: 16, fontWeight: 'bold' },
  modalSave: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f7bf0b', alignItems: 'center' },
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
  // G34 — PR banner (distinct blue accent so it reads apart from the G9 gold PB banner)
  prBanner: {
    width: '100%',
    backgroundColor: '#e8f0fe',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3274ba',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  prBannerTitle: { color: '#1A1A1A', fontWeight: '900', fontSize: 16, marginBottom: 6, letterSpacing: 1 },
  prBannerItem: { color: '#1A1A1A', fontWeight: '600', fontSize: 13, marginBottom: 2, textAlign: 'center' },
});

export default TrainingScreen;
