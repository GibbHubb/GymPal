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


export default function CreateWorkout({ navigation }) {
  const [workoutName, setWorkoutName] = useState('');
  const [difficulty, setDifficulty] = useState('Novice');
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [exercises, setExercises] = useState([
    { exercise_id: null, name: '', repRange: '', sets: '', rir: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]); // Store results per exercise index
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
    setSearchResults([...searchResults, []]); // Ensure search results remain in sync
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
        updatedResults[index] = filtered; // Store results for the specific input field
        return updatedResults;
      });
    } else {
      setSearchResults((prev) => {
        const updatedResults = [...prev];
        updatedResults[index] = []; // Clear results for this input field
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
      updatedResults[index] = []; // Clear search results after selection
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
        Alert.alert('Error', 'Please complete all exercises or remove empty ones.');
        return;
      }

      setIsSaving(true);
      // 🔍 Check stored AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('📂 AsyncStorage Keys:', allKeys);
  
      // ✅ Fetch `user_id` instead of `trainer_id`
      const userId = await AsyncStorage.getItem('user_id');
      console.log('📌 Retrieved User ID:', userId);
  
      if (!userId) {
        console.log('❌ User ID is missing!');
        Alert.alert('Error', 'User ID is missing. Please log in again.');
        return;
      }
  
      const payload = {
        name: workoutName,
        difficulty,
        trainer_id: parseInt(userId, 10), // ✅ Use `user_id` as `trainer_id`
        date: new Date().toISOString(),
        exercises: exercises.map((exercise) => ({
          exercise_id: exercise.exercise_id,
          reps: exercise.repRange,
          sets: parseInt(exercise.sets, 10) || 0,
          weight: 0,
        })),
        participants: [],
      };
  
      console.log('📤 Sending request with payload:', JSON.stringify(payload, null, 2));
      const response = await createGroupWorkout(payload);
      console.log('✅ API Response:', response);
      
      Alert.alert('Success', 'Workout created successfully!');
      navigation.goBack();
  
    } catch (error) {
      console.error('🚨 Error inside handleSubmit:', error);
      Alert.alert('Error', 'Failed to create workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Create Workout</Text>

      <TextInput style={styles.input} placeholder="Workout Name" value={workoutName} onChangeText={setWorkoutName} />

      <View style={styles.difficultyContainer}>
        <Text style={styles.label}>Difficulty Level:</Text>
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
        <View key={index} style={styles.exerciseRow}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseLabel}>Exercise {index + 1}</Text>
            <TouchableOpacity style={styles.removeButton} onPress={() => removeExercise(index)}>
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>

          <TextInput style={styles.input} placeholder="Search Exercise" value={exercise.name} onChangeText={(text) => handleSearch(text, index)} />
          {searchResults[index] && searchResults[index].length > 0 && (
            <View style={styles.dropdownContainer}>
              {searchResults[index].map((option) => (
                <TouchableOpacity key={option.exercise_id} style={styles.dropdownItem} onPress={() => handleSelectExercise(index, option)}>
                  <Text style={styles.dropdownItemText}>{option.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statInputWrapper}>
              <Text style={styles.statLabel}>Reps</Text>
              <TextInput style={styles.statInput} placeholder="10-12" value={exercise.repRange} onChangeText={(text) => updateExercise(index, 'repRange', text)} />
            </View>
            <View style={styles.statInputWrapper}>
              <Text style={styles.statLabel}>Sets</Text>
              <TextInput style={styles.statInput} placeholder="3" keyboardType="numeric" value={exercise.sets} onChangeText={(text) => updateExercise(index, 'sets', text)} />
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addExercise}>
        <Text style={styles.buttonText}>Add Exercise</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={isSaving}>
        <Text style={styles.buttonText}>{isSaving ? "Saving..." : "Save Workout"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF', // White background for clarity
  },
  logo: {
    width: 150,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 20,
    alignSelf: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: '#f7bf0b', // GymPal Gold
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#3274ba', // GymPal Blauw
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f8f8f8', // Light Grey Background for contrast
    borderColor: '#8ebce6', // GymPal Light Blue
    color: '#1A1A1A',
    fontSize: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 5,
  },
  difficultyContainer: {
    marginBottom: 15,
    width: '100%',
  },
  difficultyOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  difficultyButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 5,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8ebce6', // GymPal Light Blue
  },
  difficultySelected: {
    backgroundColor: '#3274ba', // GymPal Blauw
  },
  difficultyText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  difficultyTextSelected: {
    color: '#fff', // White text for selected button
  },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 18,
  },
  saveButton: {
    backgroundColor: '#f7bf0b', // GymPal Gold
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3, // Adds a subtle depth effect
  },
  exerciseRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3274ba',
  },
  removeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeButtonText: {
    color: '#ff4c4c',
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statInputWrapper: {
    width: '48%',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statInput: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    borderColor: '#8ebce6',
    color: '#1A1A1A',
    fontSize: 14,
    textAlign: 'center',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#8ebce6',
    borderRadius: 8,
    marginTop: -5,
    marginBottom: 10,
    maxHeight: 200,
    zIndex: 1000,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  addButton: {
    backgroundColor: '#3274ba',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    marginTop: 10,
  },

  
});
