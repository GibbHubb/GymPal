import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { fetchGroupWorkoutDetails, addParticipantsToWorkout, fetchSuggestedWeights, editGroupWorkout } from '../../utils/api';
import { checkUserExists, fetchExercises, addExerciseToWorkout } from '../../utils/api';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomButton from '../../components/CustomButton';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';
import { ActivityIndicator } from 'react-native';

const MemoizedInput = memo(({ value, onChange, placeholder, style }) => (
  <TextInput
    style={style}
    value={value}
    onChangeText={onChange}
    keyboardType="numeric"
    textAlign="center"
    placeholder={placeholder}
    placeholderTextColor="#555"
  />
));

export default function EditWorkoutScreen({ route, navigation }) {
  const { workoutId, workoutDetails } = route.params || {};
  const [workout, setWorkout] = useState(workoutDetails || null);
  const [participants, setParticipants] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newParticipant, setNewParticipant] = useState('');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [newReps, setNewReps] = useState('');
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [newExercise, setNewExercise] = useState('');
  const [allExercises, setAllExercises] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const results = await fetchExercises(); 
        setAllExercises(results);
      } catch (error) {
        console.error("❌ Error fetching exercises:", error);
      }
    };
    loadExercises();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation, workout]);

  useEffect(() => {
    const loadWorkoutDetails = async () => {
      if (!workoutId) return;

      try {
        let fetchedWorkout = workoutDetails || await fetchGroupWorkoutDetails(workoutId);
        setWorkout(fetchedWorkout);
        setExercises(fetchedWorkout.exercises || []);

        const suggestedWeights = await fetchSuggestedWeights(workoutId);
        if (Array.isArray(suggestedWeights) && suggestedWeights.length > 0) {
          const participantWeightsMap = {};
          const participantRepsMap = {};

          suggestedWeights.forEach((sw) => {
            if (!participantWeightsMap[sw.user_id]) participantWeightsMap[sw.user_id] = {};
            participantWeightsMap[sw.user_id][sw.exercise_id] = sw.suggested_weight;
          });

          fetchedWorkout.participants.forEach((p) => {
            p.exercises.forEach((e) => {
              if (!participantRepsMap[p.user_id]) participantRepsMap[p.user_id] = {};
              participantRepsMap[p.user_id][e.exercise_id] = e.reps;
            });
          });

          setParticipants(fetchedWorkout.participants.map((p) => ({
            ...p,
            weights: participantWeightsMap[p.user_id] || {},
            reps: participantRepsMap[p.user_id] || {},
          })));
        } else {
          setParticipants(fetchedWorkout.participants || []);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch workout details.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadWorkoutDetails();
  }, [workoutId]);

  const handleUpdateValue = useCallback((userId, exerciseId, field, value) => {
    setParticipants((prevParticipants) =>
      prevParticipants.map((participant) => {
        if (participant.user_id === userId) {
          return {
            ...participant,
            [field]: {
              ...participant[field],
              [exerciseId]: value,
            },
          };
        }
        return participant;
      })
    );
  }, []);

  const handleSearchExercise = (query) => {
    setExerciseSearchQuery(query);
    if (!query.trim()) {
      setExerciseOptions([]);
      return;
    }
    const filteredResults = allExercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(query.toLowerCase())
    );
    setExerciseOptions(filteredResults);
  };

  const handleExerciseSelect = (exercise) => {
    setNewExercise(exercise.name);
    setExerciseSearchQuery('');
    setExerciseOptions([]);
  };

  const handleAddParticipant = async () => {
    if (!newParticipant.trim()) {
      Alert.alert('Error', 'Please enter a valid participant name.');
      return;
    }
    try {
      const existingUser = await checkUserExists(newParticipant);
      if (!existingUser) {
        Alert.alert('Error', `User "${newParticipant}" not found.`);
        return;
      }
      await addParticipantsToWorkout(workoutId, [{ user_id: existingUser.user_id }]);
      const updatedWorkout = await fetchGroupWorkoutDetails(workoutId);
      const updatedSuggestedWeights = await fetchSuggestedWeights(workoutId);
      const participantWeightsMap = {};
      const participantRepsMap = {};

      updatedSuggestedWeights.forEach((sw) => {
        if (!participantWeightsMap[sw.user_id]) participantWeightsMap[sw.user_id] = {};
        participantWeightsMap[sw.user_id][sw.exercise_id] = sw.suggested_weight || 0;
      });

      updatedWorkout.participants.forEach((p) => {
        p.exercises.forEach((e) => {
          if (!participantRepsMap[p.user_id]) participantRepsMap[p.user_id] = {};
          participantRepsMap[p.user_id][e.exercise_id] = e.reps || 0;
        });
      });

      setParticipants(updatedWorkout.participants.map((p) => ({
        ...p,
        weights: participantWeightsMap[p.user_id] || {},
        reps: participantRepsMap[p.user_id] || {},
      })));

      setWorkout(updatedWorkout);
      setNewParticipant('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add participant.');
    }
  };

  const handleRemoveParticipant = (userId) => {
    const updatedParticipants = participants.filter(p => p.user_id !== userId);
    setParticipants(updatedParticipants);
    setWorkout(prev => ({ ...prev, participants: updatedParticipants }));
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      const updatedWorkout = { ...workout, participants, exercises };
      await editGroupWorkout(workoutId, updatedWorkout);
      Alert.alert('Success', 'Workout updated successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update workout.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExercise = async () => {
    if (!newExercise.trim()) {
      Alert.alert('Error', 'Please select an exercise.');
      return;
    }
    if (!newReps.trim() || isNaN(newReps) || parseInt(newReps, 10) <= 0) {
      Alert.alert('Error', 'Please enter valid reps.');
      return;
    }
    try {
      const selectedExercise = allExercises.find(ex => ex.name === newExercise);
      if (!selectedExercise) {
        Alert.alert('Error', 'Selected exercise not found.');
        return;
      }
      await addExerciseToWorkout({
        workout_id: workoutId,
        exercise_id: selectedExercise.exercise_id,
        reps: parseInt(newReps, 10),
        sets: 3
      });
      const updatedWorkout = await fetchGroupWorkoutDetails(workoutId);
      const updatedSuggestedWeights = await fetchSuggestedWeights(workoutId);
      const participantWeightsMap = {};
      const participantRepsMap = {};

      updatedSuggestedWeights.forEach((sw) => {
        if (!participantWeightsMap[sw.user_id]) participantWeightsMap[sw.user_id] = {};
        participantWeightsMap[sw.user_id][sw.exercise_id] = sw.suggested_weight || 0;
      });

      updatedWorkout.participants.forEach((p) => {
        p.exercises.forEach((e) => {
          if (!participantRepsMap[p.user_id]) participantRepsMap[p.user_id] = {};
          participantRepsMap[p.user_id][e.exercise_id] = e.reps || 0;
        });
      });

      setWorkout(updatedWorkout);
      setExercises(updatedWorkout.exercises || []);
      setParticipants(updatedWorkout.participants.map((p) => ({
        ...p,
        weights: participantWeightsMap[p.user_id] || {},
        reps: participantRepsMap[p.user_id] || {},
      })));
      setNewExercise('');
      setNewReps('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add exercise to workout.');
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <CustomHeader title="Edit Workout" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={[styles.header, { marginTop: 20 }]}>Loading Workout...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={true}>
      <CustomHeader title={workout?.name || 'Edit Workout'} />
      <View style={styles.container}>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add Participant..."
            placeholderTextColor="#888"
            value={newParticipant}
            onChangeText={setNewParticipant}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="Search exercise..."
              placeholderTextColor="#888"
              value={newExercise}
              onChangeText={handleSearchExercise}
            />
            {exerciseOptions.length > 0 && (
              <View style={styles.dropdown}>
                {exerciseOptions.map((exercise, index) => (
                  <TouchableOpacity
                    key={exercise.exercise_id || index}
                    style={styles.dropdownItem}
                    onPress={() => handleExerciseSelect(exercise)}
                  >
                    <Text style={styles.dropdownItemText}>{exercise.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TextInput
            style={styles.repsInput}
            placeholder="Reps"
            placeholderTextColor="#888"
            value={newReps}
            onChangeText={setNewReps}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.addButton} onPress={handleAddExercise}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.headerRow}>
              <View style={styles.firstColumn} />
              {participants.map((participant, index) => (
                <View key={index} style={styles.headerCellContainer}>
                  <Text style={styles.headerCell}>{participant.participant_name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveParticipant(participant.user_id)} style={styles.removeIcon}>
                    <Text style={{ color: Theme.colors.error, fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.subHeaderRow}>
              <View style={styles.firstColumn} />
              {participants.map((_, index) => (
                <View key={index} style={styles.subHeaderContainer}>
                  <Text style={styles.subHeaderText}>WT</Text>
                  <Text style={styles.subHeaderText}>RP</Text>
                </View>
              ))}
            </View>

            <View style={styles.gridBody}>
              {exercises.map((exercise, exerciseIndex) => (
                <View key={exercise.exercise_id || exerciseIndex} style={styles.row}>
                  <View style={styles.exerciseCell}>
                    <Text style={styles.exerciseText}>{exercise.exercise_name}</Text>
                  </View>

                  {participants.map((participant, participantIndex) => {
                    const weightVal = String(participant.weights?.[exercise.exercise_id] || '');
                    const repVal = String(participant.reps?.[exercise.exercise_id] || '');
                    return (
                      <View key={`${participantIndex}-${exercise.exercise_id}`} style={styles.inputRow}>
                        <View style={styles.dataBox}>
                          <MemoizedInput
                            style={styles.dataText}
                            value={weightVal}
                            onChange={(text) => handleUpdateValue(participant.user_id, exercise.exercise_id, 'weights', text)}
                            placeholder="0"
                          />
                        </View>
                        <View style={styles.dataBox}>
                          <MemoizedInput
                            style={styles.dataText}
                            value={repVal}
                            onChange={(text) => handleUpdateValue(participant.user_id, exercise.exercise_id, 'reps', text)}
                            placeholder="0"
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <CustomButton 
            title={isSaving ? "Saving..." : "Save Changes"} 
            onPress={handleSaveChanges} 
            disabled={isSaving}
            style={styles.footerBtn}
          />
          <CustomButton 
            title="Start Training" 
            onPress={() => {
              navigation.navigate('TrainerScreen', { workoutId, workoutDetails: { ...workout, participants, exercises } });
            }}
            style={styles.footerBtn}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 50, backgroundColor: Theme.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRowTop: { flexDirection: 'row', justifyContent: 'flex-start', marginVertical: 10 },
  backBtnAction: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.glassBorder },
  backBtnTextAction: { color: '#fff', fontSize: 13, fontWeight: '700' },
  header: { ...Theme.typography.title, color: Theme.colors.primary, textAlign: 'center', marginBottom: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  input: { flex: 1, padding: 10, borderWidth: 1, borderColor: Theme.colors.glassBorder, borderRadius: 8, backgroundColor: Theme.colors.surface, color: '#fff' },
  repsInput: { width: 60, padding: 10, borderWidth: 1, borderColor: Theme.colors.glassBorder, borderRadius: 8, backgroundColor: Theme.colors.surface, color: '#fff', textAlign: 'center', marginLeft: 8 },
  addButton: { backgroundColor: Theme.colors.primary, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, marginLeft: 8 },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 14 },
  headerRow: { flexDirection: 'row', marginBottom: 5 },
  firstColumn: { width: 100 },
  headerCellContainer: { flex: 1, width: 120, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 4, marginHorizontal: 2, position: 'relative' },
  headerCell: { fontWeight: '900', fontSize: 12, color: Theme.colors.text, textAlign: 'center', textTransform: 'uppercase' },
  removeIcon: { position: 'absolute', top: 2, right: 2 },
  subHeaderRow: { flexDirection: 'row', marginBottom: 5 },
  subHeaderContainer: { flexDirection: 'row', justifyContent: 'space-evenly', width: 120, marginHorizontal: 2 },
  subHeaderText: { fontSize: 10, fontWeight: 'bold', color: Theme.colors.textSecondary, width: 50, textAlign: 'center' },
  gridBody: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  exerciseCell: { width: 100, paddingVertical: 15, paddingRight: 10 },
  exerciseText: { fontSize: 13, fontWeight: '700', color: Theme.colors.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 5, width: 120, marginHorizontal: 2 },
  dataBox: { backgroundColor: 'rgba(255,255,255,0.03)', paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, marginHorizontal: 2, width: 50 },
  dataText: { fontSize: 14, fontWeight: '900', color: '#fff', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  footerBtn: { width: '48%' },
  dropdown: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: Theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.primary, zIndex: 1000, maxHeight: 150 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  dropdownItemText: { color: '#fff', fontSize: 14 }
});
