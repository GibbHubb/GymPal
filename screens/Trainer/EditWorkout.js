import React, { useEffect, useState } from 'react';
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
import { checkUserExists, fetchExercises, addExerciseToWorkout, api } from '../../utils/api';



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
  const [allExercises, setAllExercises] = useState([]); // ✅ Store all exercises globally

  useEffect(() => {
    const loadExercises = async () => {
      try {
        console.log("📡 Fetching all exercises...");
        const results = await fetchExercises(); // ✅ Fetch once, store in state
        setAllExercises(results);
        console.log("✅ Loaded Exercises:", results);
      } catch (error) {
        console.error("❌ Error fetching exercises:", error);
      }
    };

    loadExercises();
  }, []);


  // Add back button to header
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      ),
      headerTitle: workout?.name || 'Edit Workout', // Ensures the workout name appears
    });
  }, [navigation, workout]);

  useEffect(() => {
    const loadWorkoutDetails = async () => {
      if (!workoutId) return;

      try {
        let fetchedWorkout = workoutDetails || await fetchGroupWorkoutDetails(workoutId);
        setWorkout(fetchedWorkout);
        setExercises(fetchedWorkout.exercises || []);

        // Fetch suggested weights
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

          // Only update if there is an actual change
          setParticipants((prev) => {
            const updatedParticipants = fetchedWorkout.participants.map((p) => ({
              ...p,
              weights: participantWeightsMap[p.user_id] || {},
              reps: participantRepsMap[p.user_id] || {},
            }));

            return JSON.stringify(prev) === JSON.stringify(updatedParticipants) ? prev : updatedParticipants;
          });
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
  }, [workoutId]); // ✅ Dependency list prevents infinite loops

  const handleUpdateValue = (userId, exerciseId, field, value) => {
    setParticipants((prevParticipants) =>
      prevParticipants.map((participant) => {
        if (participant.user_id === userId) {
          return {
            ...participant,
            [field]: {
              ...participant[field],
              [exerciseId]: value, // Dynamically update weights or reps
            },
          };
        }
        return participant;
      })
    );
  };

  const handleSearchExercise = (query) => {
    setExerciseSearchQuery(query); // Update search bar value
    if (!query.trim()) {
      setExerciseOptions([]); // Hide dropdown if empty
      return;
    }

    // Filter exercises based on query
    const filteredResults = allExercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(query.toLowerCase())
    );

    setExerciseOptions(filteredResults); // Update dropdown list
  };

  const handleExerciseSelect = (exercise) => {
    // Set the selected exercise to the input field
    setNewExercise(exercise.name);
    setExerciseSearchQuery(''); // Clear search query after selection
    setExerciseOptions([]); // Clear the dropdown list
  };


  const handleAddParticipant = async () => {
    if (!newParticipant.trim()) {
      Alert.alert('Error', 'Please enter a valid participant name.');
      return;
    }

    try {
      console.log(`🔍 Checking if participant "${newParticipant}" exists...`);

      // ✅ Step 1: Check if the participant exists
      const existingUser = await checkUserExists(newParticipant);
      if (!existingUser) {
        Alert.alert('Error', `User "${newParticipant}" not found.`);
        return;
      }

      console.log(`✅ User found:`, existingUser);

      // ✅ Step 2: Add participant to the workout
      await addParticipantsToWorkout(workoutId, [{ user_id: existingUser.user_id }]);

      console.log(`➕ Added user ${existingUser.user_id} to workout ${workoutId}`);

      // ✅ Step 3: Fetch FULL WORKOUT DETAILS (Reps come from here)
      const updatedWorkout = await fetchGroupWorkoutDetails(workoutId);
      console.log(`📋 Updated Workout Details:`, updatedWorkout);

      // ✅ Step 4: Fetch SUGGESTED WEIGHTS (Weights come from here)
      const updatedSuggestedWeights = await fetchSuggestedWeights(workoutId);
      console.log(`🏋️ Updated Suggested Weights:`, updatedSuggestedWeights);

      const participantWeightsMap = {};
      const participantRepsMap = {};

      // ✅ Process Suggested Weights
      updatedSuggestedWeights.forEach((sw) => {
        if (!participantWeightsMap[sw.user_id]) participantWeightsMap[sw.user_id] = {};
        participantWeightsMap[sw.user_id][sw.exercise_id] = sw.suggested_weight || 0;
      });

      // ✅ Process Reps from Workout
      updatedWorkout.participants.forEach((p) => {
        p.exercises.forEach((e) => {
          if (!participantRepsMap[p.user_id]) participantRepsMap[p.user_id] = {};
          participantRepsMap[p.user_id][e.exercise_id] = e.reps || 0;
        });
      });

      console.log(`💪 Mapped Weights:`, participantWeightsMap);
      console.log(`🔢 Mapped Reps:`, participantRepsMap);

      // ✅ Step 5: Update Participants in State
      setParticipants(updatedWorkout.participants.map((p) => ({
        ...p,
        weights: participantWeightsMap[p.user_id] || {}, // ✅ Now weights are set immediately
        reps: participantRepsMap[p.user_id] || {},      // ✅ Reps remain correct
      })));

      setWorkout(updatedWorkout); // ✅ Also update workout state
      setNewParticipant(''); // ✅ Clear input field
    } catch (error) {
      console.error('❌ Error adding participant:', error);
      Alert.alert('Error', 'Failed to add participant.');
    }
  };

const handleRemoveParticipant = (userId) => {
  const updatedParticipants = participants.filter(p => p.user_id !== userId);
  setParticipants(updatedParticipants);

  // Optional: Update the workout object too if needed
  setWorkout(prev => ({
    ...prev,
    participants: updatedParticipants
  }));
};

  




  const handleSaveChanges = async () => {
    try {
      const updatedWorkout = {
        ...workout,
        participants,
        exercises,
      };

      console.log("📤 Saving workout with data:", updatedWorkout);

      await editGroupWorkout(workoutId, updatedWorkout);

      // ✅ Refresh suggested weights after saving
      const updatedSuggestedWeights = await fetchSuggestedWeights(workoutId);

      console.log(`🏋️ Suggested weights updated:`, updatedSuggestedWeights);

      const participantWeightsMap = {};
      updatedSuggestedWeights.forEach((sw) => {
        if (!participantWeightsMap[sw.user_id]) participantWeightsMap[sw.user_id] = {};
        participantWeightsMap[sw.user_id][sw.exercise_id] = sw.suggested_weight;
      });

      setParticipants((prevParticipants) =>
        prevParticipants.map((p) => ({
          ...p,
          weights: participantWeightsMap[p.user_id] || {},
        }))
      );

      Alert.alert('Success', 'Workout updated successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('❌ Error updating workout:', error);
      Alert.alert('Error', 'Failed to update workout.');
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
      console.log(`🔍 Adding exercise "${newExercise}" with ${newReps} reps...`);
  
      const selectedExercise = allExercises.find(ex => ex.name === newExercise);
  
      if (!selectedExercise) {
        Alert.alert('Error', 'Selected exercise not found.');
        return;
      }
  
      const payload = {
        exercise_id: selectedExercise.exercise_id,
        reps: parseInt(newReps, 10),
        sets: 3 // default
      };
  
        const response = await addExerciseToWorkout({
        workout_id: workoutId,
        exercise_id: selectedExercise.exercise_id,
        reps: parseInt(newReps, 10),
        sets: 3
      });
      
  
      console.log(`✅ Exercise added to workout:`, response.data);
  
      // Refresh workout and weights
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
  
      // Clear inputs
      setNewExercise('');
      setNewReps('');
    } catch (error) {
      console.error('❌ Error adding exercise:', error.response?.data || error);
      Alert.alert('Error', 'Failed to add exercise to workout.');
    }
  };
  
  
  

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.container}>
        {/* GymPal Logo */}
        <Text style={styles.header}>{workout?.name || 'Edit Workout'}</Text>

        {/* Add Participant */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter participant name"
            placeholderTextColor="#555"
            value={newParticipant}
            onChangeText={setNewParticipant}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>

        </View>

        {/* Add Exercise */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search exercise"
            placeholderTextColor="#555"
            value={newExercise}  // Set value to the selected exercise
            onChangeText={handleSearchExercise}  // Update query on typing
          />


          {exerciseOptions.length > 0 && (
            <View style={styles.dropdown}>
              {exerciseOptions.map((exercise, index) => (
                <TouchableOpacity
                  key={exercise.exercise_id || index}  // Ensure unique key
                  style={styles.dropdownItem}
                  onPress={() => handleExerciseSelect(exercise)}  // Select exercise
                >
                  <Text style={styles.dropdownItemText}>{exercise.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}



<TextInput
  style={styles.repsInput}
  placeholder="Reps"
  placeholderTextColor="#555"
  value={newReps} // Make sure this is the correct value
  onChangeText={setNewReps}
  keyboardType="numeric"
/>



          <TouchableOpacity style={styles.addButton} onPress={handleAddExercise}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>


        {/* Grid Layout */}
        <ScrollView horizontal>
          <View>
            {/* Header Row - First cell is blank, then participant names */}
            <View style={styles.headerRow}>
  <View style={styles.firstColumn} />
  {participants.map((participant, index) => (
    <View key={index} style={styles.headerCellContainer}>
      <Text style={styles.headerCell}>
        {participant.participant_name}
      </Text>
      <TouchableOpacity onPress={() => handleRemoveParticipant(participant.user_id)}>
        <Text style={{ color: 'red', fontWeight: 'bold' }}>❌</Text>
      </TouchableOpacity>
    </View>
  ))}
</View>


            {/* Weight & Reps Labels Row */}
            <View style={styles.subHeaderRow}>
              <View style={styles.firstColumn} />
              {participants.map((_, index) => (
                <View key={index} style={styles.subHeaderContainer}>
                  <Text style={styles.subHeaderText}>Weight</Text>
                  <Text style={styles.subHeaderText}>Reps</Text>
                </View>
              ))}
            </View>

            {/* Exercises & Inputs */}
            <ScrollView contentContainerStyle={styles.scrollContainer}>

              {exercises.map((exercise, exerciseIndex) => (
                <View key={exercise.exercise_id || exerciseIndex} style={styles.row}>
                  <View style={styles.exerciseCell}>
                    <Text style={styles.exerciseText}>{exercise.exercise_name}</Text>
                  </View>

                  {participants.map((participant, participantIndex) => (
                    <View key={`${participantIndex}-${exercise.exercise_id}`} style={styles.inputRow}>
                      <View style={styles.dataBox}>
                        <TextInput
                          style={[styles.dataText]}
                          value={String(participant.weights?.[exercise.exercise_id] || '')}
                          onChangeText={(text) => handleUpdateValue(participant.user_id, exercise.exercise_id, 'weights', text)}
                          keyboardType="numeric"
                          textAlign="center"
                          placeholder="0"
                        />
                      </View>

                      <View style={styles.dataBox}>
                        <TextInput
                          style={[styles.dataText]}
                          value={String(participant.reps?.[exercise.exercise_id] || '')}
                          onChangeText={(text) => handleUpdateValue(participant.user_id, exercise.exercise_id, 'reps', text)}
                          keyboardType="numeric"
                          textAlign="center"
                          placeholder="0"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ))}



            </ScrollView>
          </View>

        </ScrollView>


        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton}>
            <Text onPress={handleSaveChanges} style={styles.buttonText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startButton} onPress={() => {
            navigation.navigate('TrainerScreen', { workoutId, workoutDetails: { ...workout, participants, exercises } });
          }}>
            <Text style={styles.buttonText}>Start Training</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 📱 General Layout
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 150,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 20,
    alignSelf: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#3274ba',
    marginBottom: 16,
  },

  // 🔙 Back Button
  backButton: {
    marginLeft: 10,
    padding: 8,
  },
  backButtonText: {
    color: '#3274ba',
    fontSize: 18,
  },

  // 🧾 Input Fields
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#8ebce6',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    color: '#1A1A1A',
  },
  repsInput: {
    width: 60,
    padding: 10,
    borderWidth: 1,
    borderColor: '#8ebce6',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#f7bf0b',
    paddingVertical: 10,
    paddingGymPaltal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1A1A1A',
  },

  // 📊 Table Headers
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#3274ba',
    paddingVertical: 8,
  },
  subHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#d4e5f7',
    paddingVertical: 5,
  },
  firstColumn: {
    width: 120,
    backgroundColor: 'transparent',
  },
  headerCellContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },

  // 🏷 Subheader Labels
  subHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    flex: 1,
    paddingVertical: 5,
  },
  subHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    flex: 1,
  },

  // 🏋️‍♂️ Exercise Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  exerciseCell: {
    width: 120,
    paddingVertical: 12,
    paddingGymPaltal: 10,
    backgroundColor: '#8ebce6',
  },
  exerciseText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // 🔢 Weight & Reps Boxes
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  dataBox: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 6,
    paddingGymPaltal: 12,
    borderWidth: 1,
    borderColor: '#8ebce6',
    borderRadius: 8,
    marginGymPaltal: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  dataText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },

  // 🏁 Footer Buttons
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: '#f7bf0b',
    padding: 14,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#3274ba',
    padding: 14,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },

  // 🔽 Suggestions / Dropdown
  suggestionsBox: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    zIndex: 100,
  },
  suggestionItem: {
    padding: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  dropdown: {
    position: 'absolute',
    top: 50, // Replace with a variable if dynamic
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingGymPaltal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 100,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    zIndex: 100,
  },
});
