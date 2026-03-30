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
    console.log('🔥 handleSubmit() function triggered!');
  
    try {
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
  
    } catch (error) {
      console.error('🚨 Error inside handleSubmit:', error);
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
          <TextInput style={styles.input} placeholder="Search Exercise" value={exercise.name} onChangeText={(text) => handleSearch(text, index)} />
          {searchResults[index] && searchResults[index].length > 0 && (
            <View style={styles.dropdownContainer}>
              {searchResults[index].map((option) => (
                <TouchableOpacity key={option.exercise_id} style={styles.dropdownItem} onPress={() => handleSelectExercise(index, option)}>
                  <Text>{option.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput style={styles.input} placeholder="Rep Range" value={exercise.repRange} onChangeText={(text) => updateExercise(index, 'repRange', text)} />
          <TextInput style={styles.input} placeholder="Sets" keyboardType="numeric" value={exercise.sets} onChangeText={(text) => updateExercise(index, 'sets', text)} />

          <TouchableOpacity style={styles.removeButton} onPress={() => removeExercise(index)}>
            <Text style={styles.removeButtonText}>-</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addExercise}>
        <Text style={styles.buttonText}>Add Exercise</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Save Workout</Text>
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
    paddingGymPaltal: 14,
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
    marginGymPaltal: 5,
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3, // Adds a subtle depth effect
  },

  
});
