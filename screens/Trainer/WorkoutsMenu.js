import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {
  fetchWorkoutsByLevel,
  fetchYourWorkouts,
  fetchLast10Workouts,
  fetchMostUsedWorkouts,
  searchWorkouts,
  fetchGroupWorkoutDetails,
} from '../../utils/api';


export default function WorkoutsMenu({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Navigate to CreateWorkoutScreen
  const handleNavigateToCreateWorkout = () => navigation.navigate('CreateWorkout');

  // Navigate to EditWorkoutScreen
  const handleNavigateToEditWorkout = async (workoutId) => {
    setLoading(true);
    try {
      const workoutDetails = await fetchGroupWorkoutDetails(workoutId);
      navigation.navigate('EditWorkout', { workoutId, workoutDetails });
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch workout details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchWorkouts = async (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setWorkouts([]); // ✅ Reset if search is empty
      return;
    }

    console.log(`🔍 Searching for workouts: ${query}`); // ✅ Debug Log
    setLoading(true);

    try {
      const results = await searchWorkouts(query);
      console.log('📊 Search Results:', results); // ✅ Debug Log

      if (!results || results.length === 0) {
        Alert.alert('No Results', `No workouts found for "${query}".`);
        setWorkouts([]);
      } else {
        setWorkouts(results.slice(0, 10)); // ✅ Limit results if needed
      }
    } catch (error) {
      console.error('❌ Error searching workouts:', error);
      Alert.alert('Error', 'Failed to search workouts.');
    } finally {
      setLoading(false);
    }
  };


  // Fetch workouts dynamically
  const handleFetchWorkouts = async (fetchFunction, label) => {
    console.log(`Fetching ${label} workouts...`); // ✅ Debugging Log
    setLoading(true);

    try {
      const data = await fetchFunction(); // ✅ Call API Function
      console.log('Fetched Data:', data); // ✅ Debugging Log

      if (!data || data.length === 0) {
        Alert.alert('No Workouts', `No ${label} workouts found.`);
        setWorkouts([]); // ✅ Make sure to reset state
      } else {
        setWorkouts(data); // ✅ Properly update state
      }
    } catch (error) {
      console.error(`Error fetching ${label} workouts:`, error);
      Alert.alert('Error', `Failed to fetch ${label} workouts.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* GymPal Logo */}
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Workout Menu</Text>

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="🔍 Search workouts"
        placeholderTextColor="#555"
        value={searchQuery}
        onChangeText={handleSearchWorkouts} // ✅ Calls search function when typing
      />


      {/* Loader */}
      {loading && <ActivityIndicator size="large" color="#f7bf0b" />}

      {/* Workouts List */}
      <FlatList
        data={workouts}
        keyExtractor={(item, index) => item?.group_workout_id?.toString() || index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.workoutItem}
            onPress={() => handleNavigateToEditWorkout(item.group_workout_id)}
          >
            <Text style={styles.workoutName}>{item.name}</Text>
            <Text style={styles.workoutDate}>{new Date(item.date).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>No workouts found.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Workout Category Buttons */}
      <View style={styles.topButtonContainer}>
        <TouchableOpacity style={styles.mainButton} onPress={() => handleFetchWorkouts(fetchYourWorkouts, 'Your Workouts')}>
          <Text style={styles.mainButtonText}>Your Workouts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainButton} onPress={() => handleFetchWorkouts(fetchLast10Workouts, 'Last 10 Workouts')}>
          <Text style={styles.mainButtonText}>Last 10</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainButton} onPress={() => handleFetchWorkouts(fetchMostUsedWorkouts, 'Most Used Workouts')}>
          <Text style={styles.mainButtonText}>Most Used</Text>
        </TouchableOpacity>
      </View>

      {/* Level Buttons */}
      <View style={styles.levelContainer}>
        {['Novice', 'Beginner', 'Intermediate', 'Advanced'].map((level) => (
          <TouchableOpacity key={level} style={styles.subButton} onPress={() => handleFetchWorkouts(() => fetchWorkoutsByLevel(level), level)}>
            <Text style={styles.subButtonText}>{level}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Create Workout Button */}
      <TouchableOpacity style={styles.createWorkoutButton} onPress={handleNavigateToCreateWorkout}>
        <Text style={styles.createWorkoutButtonText}>➕ Create a Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
  logo: { width: 150, height: 80, resizeMode: 'contain', marginBottom: 20, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', backgroundColor: '#f7bf0b', padding: 10, borderRadius: 8, marginBottom: 10 },
  backButtonText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 16 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#3274ba', marginBottom: 16 },
  searchInput: { borderWidth: 1, borderColor: '#8ebce6', borderRadius: 8, padding: 10, backgroundColor: '#f8f8f8', color: '#333', marginBottom: 16 },
  workoutItem: { backgroundColor: '#8ebce6', padding: 16, borderRadius: 8, marginBottom: 8 },
  workoutName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  workoutDate: { fontSize: 14, color: '#555' },
  emptyText: { textAlign: 'center', fontSize: 16, color: '#777', marginVertical: 16 },
  levelContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  subButton: { backgroundColor: '#3274ba', padding: 12, borderRadius: 8, marginBottom: 8, width: '23%' },
  subButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  topButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  mainButton: { backgroundColor: '#3274ba', padding: 16, borderRadius: 8, flex: 1, marginGymPaltal: 5 },
  mainButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  createWorkoutButton: { backgroundColor: '#f7bf0b', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createWorkoutButtonText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 18 },
});
