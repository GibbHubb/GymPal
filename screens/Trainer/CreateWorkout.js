import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { fetchExercises, createGroupWorkout } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomButton from '../../components/CustomButton';

export default function CreateWorkout({ navigation }) {
  const [workoutName, setWorkoutName] = useState('');
  const [difficulty, setDifficulty] = useState('Novice');
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [exercises, setExercises] = useState([
    { exercise_id: null, name: '', repRange: '', sets: '', rir: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const fetchedExercises = await fetchExercises();
        setExerciseOptions(fetchedExercises);
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch exercises.');
      } finally {
        setLoading(false);
      }
    };
    loadExercises();
  }, []);

  const addExercise = () => {
    setExercises([...exercises, { exercise_id: null, name: '', repRange: '', sets: '', rir: '' }]);
    setSearchResults([...searchResults, []]);
  };

  const removeExercise = (index) => {
    setExercises(exercises.filter((_, i) => i !== index));
    setSearchResults(searchResults.filter((_, i) => i !== index));
  };

  const updateExercise = (index, field, value) => {
    setExercises(exercises.map((exercise, i) => (i === index ? { ...exercise, [field]: value } : exercise)));
  };

  const handleSearch = (text, index) => {
    updateExercise(index, 'name', text);
    if (text.length > 0) {
      const filtered = exerciseOptions.filter((option) =>
        option.name.toLowerCase().includes(text.toLowerCase())
      );
      setSearchResults((prev) => {
        const updatedResults = [...prev];
        updatedResults[index] = filtered;
        return updatedResults;
      });
    } else {
      setSearchResults((prev) => {
        const updatedResults = [...prev];
        updatedResults[index] = [];
        return updatedResults;
      });
    }
  };

  const handleSelectExercise = (index, selectedExercise) => {
    setExercises((prevExercises) => {
      const updatedExercises = [...prevExercises];
      updatedExercises[index] = {
        ...updatedExercises[index],
        name: selectedExercise.name,
        exercise_id: selectedExercise.exercise_id,
      };
      return updatedExercises;
    });
    setSearchResults((prev) => {
      const updatedResults = [...prev];
      updatedResults[index] = [];
      return updatedResults;
    });
  };

  const handleSubmit = async () => {
    try {
      if (!workoutName.trim()) {
        Alert.alert('Error', 'Please enter a workout name.');
        return;
      }
      const invalidExercise = exercises.find(ex => !ex.exercise_id || !ex.repRange || !ex.sets);
      if (invalidExercise) {
        Alert.alert('Error', 'Please complete all exercises.');
        return;
      }
      setIsSaving(true);
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) {
        Alert.alert('Error', 'User ID not found.');
        return;
      }
      const payload = {
        name: workoutName,
        difficulty,
        trainer_id: parseInt(userId, 10),
        date: new Date().toISOString(),
        exercises: exercises.map((exercise) => ({
          exercise_id: exercise.exercise_id,
          reps: exercise.repRange,
          sets: parseInt(exercise.sets, 10) || 0,
          weight: 0,
        })),
        participants: [],
      };
      await createGroupWorkout(payload);
      Alert.alert('Success', 'Workout created successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create workout.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Text style={styles.header}>Loading...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={true}>
      <View style={styles.container}>
        <View style={styles.headerRowTop}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnAction}>
            <Text style={styles.backBtnTextAction}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.header}>Create Workout</Text>

        <TextInput 
          style={styles.input} 
          placeholder="Workout Name" 
          placeholderTextColor="#888"
          value={workoutName} 
          onChangeText={setWorkoutName} 
        />

        <View style={styles.difficultyContainer}>
          <Text style={styles.label}>Difficulty:</Text>
          <View style={styles.difficultyOptions}>
            {['Novice', 'Beginner', 'Intermediate', 'Advanced'].map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.difficultyButton, difficulty === level && styles.difficultySelected]}
                onPress={() => setDifficulty(level)}
              >
                <Text style={[styles.difficultyText, difficulty === level && styles.difficultyTextSelected]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {exercises.map((exercise, index) => (
          <View key={index} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseLabel}>Exercise {index + 1}</Text>
              <TouchableOpacity onPress={() => removeExercise(index)}>
                <Text style={{ color: Theme.colors.error, fontWeight: 'bold' }}>Remove</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={styles.input} 
              placeholder="Search Exercise..." 
              placeholderTextColor="#888"
              value={exercise.name} 
              onChangeText={(text) => handleSearch(text, index)} 
            />
            
            {searchResults[index] && searchResults[index].length > 0 && (
              <View style={styles.dropdown}>
                {searchResults[index].map((option) => (
                  <TouchableOpacity 
                    key={option.exercise_id} 
                    style={styles.dropdownItem} 
                    onPress={() => handleSelectExercise(index, option)}
                  >
                    <Text style={styles.dropdownItemText}>{option.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Reps</Text>
                <TextInput 
                  style={styles.statInput} 
                  placeholder="10-12" 
                  placeholderTextColor="#555"
                  value={exercise.repRange} 
                  onChangeText={(text) => updateExercise(index, 'repRange', text)} 
                />
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Sets</Text>
                <TextInput 
                  style={styles.statInput} 
                  placeholder="3" 
                  placeholderTextColor="#555"
                  keyboardType="numeric" 
                  value={exercise.sets} 
                  onChangeText={(text) => updateExercise(index, 'sets', text)} 
                />
              </View>
            </View>
          </View>
        ))}

        <CustomButton 
          title="+ Add Exercise" 
          onPress={addExercise} 
          style={styles.addBtn}
          textStyle={{ color: '#fff' }}
        />

        <CustomButton 
          title={isSaving ? "Saving..." : "Save Workout"} 
          onPress={handleSubmit} 
          disabled={isSaving}
          style={styles.saveBtn}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 50, backgroundColor: Theme.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRowTop: { flexDirection: 'row', marginVertical: 10 },
  backBtnAction: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.glassBorder },
  backBtnTextAction: { color: '#fff', fontSize: 13, fontWeight: '700' },
  header: { ...Theme.typography.header, color: Theme.colors.primary, textAlign: 'center', marginBottom: 20 },
  input: { padding: 12, borderWidth: 1, borderColor: Theme.colors.glassBorder, borderRadius: 8, backgroundColor: Theme.colors.surface, color: '#fff', marginBottom: 15 },
  label: { ...Theme.typography.caption, color: Theme.colors.primary, marginBottom: 8 },
  difficultyContainer: { marginBottom: 20 },
  difficultyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  difficultyButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.glassBorder, backgroundColor: Theme.colors.surface },
  difficultySelected: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  difficultyText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  difficultyTextSelected: { color: '#000' },
  exerciseCard: { backgroundColor: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20 },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  exerciseLabel: { fontSize: 16, fontWeight: '900', color: Theme.colors.primary, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statBox: { width: '48%' },
  statLabel: { fontSize: 10, color: Theme.colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' },
  statInput: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10, color: '#fff', textAlign: 'center' },
  addBtn: { marginTop: 10, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.primary },
  saveBtn: { marginTop: 15 },
  dropdown: { backgroundColor: Theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.primary, marginTop: -10, marginBottom: 15, maxHeight: 150 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  dropdownItemText: { color: '#fff', fontSize: 14 }
});
