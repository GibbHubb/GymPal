import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

const API_URL = 'https://gympalbackend-production.up.railway.app/api';

import { navigationRef } from './utils/RootNavigation';
// ✅ Get token from storage for Authorization
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) console.warn('⚠️ No authentication token found in AsyncStorage.');
  return { Authorization: `Bearer ${token || ''}` };
};

// ✅ Create an Axios instance with automatic 401 logout handling
const createAuthApiInstance = async () => {
  const headers = await getAuthHeaders();

  const instance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  // 🔁 Intercept 401 responses to logout automatically
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response && error.response.status === 401) {
        await AsyncStorage.clear();

        if (navigationRef) {
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        }

        return Promise.reject(new Error('Session expired'));
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// ?? Fetch one group workout
export const fetchGroupWorkoutDetails = async (workoutId) => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get(`/group-workouts/${workoutId}`);
    return response.data;
  } catch (error) {
    console.error('? Error fetching group workout details:', error.response?.data || error.message);
    throw error;
  }
};

// ?? Fetch workouts by level
export const fetchWorkoutsByLevel = async (level) => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get('/group-workouts', { params: { level } });
    return response.data;
  } catch (error) {
    console.error(`? Error fetching workouts for level "${level}":`, error.response?.data || error.message);
    throw error;
  }
};

// ?? Workouts by current trainer
export const fetchYourWorkouts = async () => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get('/group-workouts/your-workouts');
    return response.data;
  } catch (error) {
    console.error('? Error fetching your workouts:', error.response?.data || error.message);
    throw error;
  }
};

// ?? Last 10 workouts
export const fetchLast10Workouts = async () => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get('/group-workouts/last-10');
    return response.data;
  } catch (error) {
    console.error('? Error fetching last 10 workouts:', error.response?.data || error.message);
    throw error;
  }
};

// ?? Most used workouts
export const fetchMostUsedWorkouts = async () => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get('/group-workouts/most-used');
    return response.data;
  } catch (error) {
    console.error('? Error fetching most used workouts:', error.response?.data || error.message);
    throw error;
  }
};

// ?? Search workouts
export const searchWorkouts = async (query) => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get('/group-workouts/search', { params: { query } });
    return response.data;
  } catch (error) {
    console.error('? Error searching workouts:', error.response?.data || error.message);
    throw error;
  }
};

// ? Create new workout
export const createGroupWorkout = async (workoutData) => {

  try {
    const authApi = await createAuthApiInstance();
    const response = await authApi.post('/group-workouts', workoutData);
    return response.data;
  } catch (error) {
    console.error('? Error creating workout:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update an existing group workout
 */
export const updateGroupWorkout = async (workoutId, updatedData) => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.put(`/group-workouts/${workoutId}`, updatedData);
    return response.data;
  } catch (error) {
    console.error('❌ Error updating group workout:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Add participants to a group workout
 */
export const addParticipantsToWorkout = async (workoutId, participants) => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.post(`/group-workouts/${workoutId}/participants`, { participants });
    return response.data;
  } catch (error) {
    console.error('❌ Error adding participants to workout:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Remove a participant from a group workout
 */
export const removeParticipantFromWorkout = async (workoutId, participantId) => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.delete(`/group-workouts/${workoutId}/participants/${participantId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error removing participant from workout:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch all exercises
 */
export const fetchExercises = async () => {
  const authApi = await createAuthApiInstance();
  try {
    const response = await authApi.get('/exercises');
    return response.data; // Returning the exercises
  } catch (error) {
    console.error('❌ Error fetching exercises:', error.response?.data || error.message);
    throw error; // Ensure we throw the error for proper handling
  }
};

/**
 * Login User
 */
export const loginUser = async ({ username, password }) => {
  try {

    const response = await axios.post(`${API_URL}/users/login`, { username, password });

    if (response.data.user_id && response.data.token) {
      await AsyncStorage.setItem('user_id', response.data.user_id.toString());
      await AsyncStorage.setItem('token', response.data.token);  // ✅ Store auth token
    } else {
    }

    return response.data;
  } catch (error) {
    console.error('❌ Server Login Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Login request failed.');
  }
};

/**
 * Fetch Intake Data (Updated to use Axios)
 */
export const fetchIntakeData = async (user_id) => {
  try {
    const api = await createAuthApiInstance();  // ✅ Uses auth headers
    const response = await api.get(`/intake/${user_id}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching intake data:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Submit Intake Data (Updated to use Axios)
 */
export const submitIntakeData = async (intakeData) => {
  try {
    const api = await createAuthApiInstance();
    const response = await api.post('/intake', intakeData);
    return response.data;
  } catch (error) {
    console.error('❌ Error submitting intake data:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ Fetch the logged-in user's profile (Updated from `/me`)
export const fetchUserProfile = async () => {
  try {
    const api = await createAuthApiInstance();
    const response = await api.get(`/users/me`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching user profile:', error.response?.data || error.message);
    return null;
  }
};

export const fetchSuggestedWeights = async (workoutId) => {
  try {
    const api = await createAuthApiInstance();
    const response = await api.get(`/workouts/suggested-weights/${workoutId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching suggested weights:', error.response?.data || error.message);
    return [];
  }
};

// Fetch Lifestyle Data for the logged-in user
export const fetchLifestyleData = async () => {
  try {
    const user_id = await AsyncStorage.getItem('user_id');
    if (!user_id) throw new Error('❌ Error: User ID not found in AsyncStorage');

    const api = await createAuthApiInstance();
    const response = await api.get(`/lifestyle-data/${user_id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching lifestyle data:', error.response?.data || error.message);
    throw error;
  }
};

// Submit Lifestyle Data
export const submitLifestyleData = async (lifestyleData) => {
  try {
    const api = await createAuthApiInstance();
    const response = await api.post('/lifestyle-data', lifestyleData);
    return response.data;
  } catch (error) {
    console.error('❌ Error submitting lifestyle data:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Finish a group workout (log actual user performance)
 */
export const finishGroupWorkout = async (workoutId, userId, actualSets, actualReps, actualWeight) => {
  try {
    const api = await createAuthApiInstance()

    // The correct endpoint path is /api/group-workouts/finish/:id
    const response = await api.post(`/group-workouts/finish/${workoutId}`, {
      user_id: userId,
      actual_sets: actualSets,
      actual_reps: actualReps,
      actual_weight: actualWeight,
    })

    return response.data
  } catch (error) {
    console.error("Error finishing group workout:", error)
    throw error
  }
}

/**
 * Edit an existing group workout (creates a new version)
 */
export const editGroupWorkout = async (workoutId, updatedData) => {
  const api = await createAuthApiInstance();
  try {
    const response = await api.post(`/edit/${workoutId}`, updatedData);
    return response.data;
  } catch (error) {
    console.error('Error editing group workout:', error);
    throw error;
  }
};

export const submitWorkout = async (userId, workoutData) => {
  try {
    const api = await createAuthApiInstance();

    if (!workoutData || typeof workoutData !== "object" || !Array.isArray(workoutData.exercises)) {
      throw new Error(`❌ Invalid workoutData format: Expected an object with an 'exercises' array.`);
    }

    const formattedData = {
      user_id: parseInt(userId),
      name: workoutData.name || null,
      notes: workoutData.notes || null,
      group_workout_id: workoutData.group_workout_id || null,
      exercises: workoutData.exercises.map(exercise => ({
        name: exercise.name,
        sets: parseInt(exercise.sets),
        reps: parseInt(exercise.reps),
        weight: parseFloat(exercise.weight) || 0,
      })),
    };

    const response = await api.post('/workouts/workouts', formattedData);
    return response.data;
  } catch (error) {
    console.error("❌ Error submitting workout:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchProgressData = async (userId, category) => {
  try {
    const api = await createAuthApiInstance();

    const response = await api.get(`/exercises/progress/${userId}/${category}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching progress data:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch per-exercise progress (weight/reps over time)
 */
export const fetchExerciseProgress = async (exerciseId) => {
  try {
    const api = await createAuthApiInstance();
    const response = await api.get(`/workouts/progress/${exerciseId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching exercise progress:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Workout templates (trainer)
 */
export const fetchTemplates = async () => {
  const api = await createAuthApiInstance();
  const response = await api.get('/templates');
  return response.data;
};

export const createTemplate = async (name, exercises) => {
  const api = await createAuthApiInstance();
  const response = await api.post('/templates', { name, exercises });
  return response.data;
};

export const deleteTemplate = async (id) => {
  const api = await createAuthApiInstance();
  await api.delete(`/templates/${id}`);
};

export const registerUser = async ({ username, role }) => {
  try {

    const api = await createAuthApiInstance();
    const response = await api.post(`/users/register`, {
      username,
      password: 'defaultPassword123',
      role,
    });

    return response.data.user;
  } catch (error) {
    console.error('❌ Error registering user:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to register user');
  }
};

// ✅ Example function: Fetch users (ClientOverview uses this)
export const fetchUsers = async (page = 1, searchQuery = '') => {
  try {
    const api = await createAuthApiInstance();

    const response = await api.get(`/users/all`, {
      params: { page, search: searchQuery },
    });

    return response.data;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return [];
  }
};

// ✅ Fetch a user by ID
export const fetchUserById = async (userId) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(`${API_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.data;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return null;
  }
};

// ✅ Update a user
export const updateUser = async (userId, updatedData) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.put(`${API_URL}/users/${userId}`, updatedData, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    return response.data;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    throw error;
  }
};

export const checkUserExists = async (username) => {

  const authApi = await createAuthApiInstance();
  
  try {
    const response = await authApi.get(`/users/check/${encodeURIComponent(username)}`);

    
    return response.data.user || null;
  } catch (error) {
    console.error('❌ Error checking user:', error.response?.data || error.message);
    return null;
  }
};

export const addExerciseToWorkout = async (data) => {
  const authApi = await createAuthApiInstance();

  try {
    const response = await authApi.post(`/group-workouts/${data.workout_id}/exercises`, {
      exercise_id: data.exercise_id,
      reps: data.reps,
      sets: data.sets || 3
    });

    return response.data;
  } catch (error) {
    console.error("❌ Error adding exercise to workout:", error.response?.data || error.message);
    throw error;
  }
};

export const searchExercises = async (query) => {

  const authApi = await createAuthApiInstance();

  try {
    const response = await authApi.get(`/exercises/search?query=${encodeURIComponent(query)}`);
    return response.data.exercises || [];
  } catch (error) {
    console.error('❌ Error fetching exercises:', error.response?.data || error.message);
    return [];
  }
};
