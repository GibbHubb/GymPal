import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { fetchProgressData, fetchExercises, fetchExerciseProgress } from '../../utils/api';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';

const ProgressScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('category');

  // Category tab state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [{ data: [] }],
  });

  // Exercise tab state
  const [exercises, setExercises] = useState([]);
  const [exercisesLoaded, setExercisesLoaded] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseChartData, setExerciseChartData] = useState(null);

  const exerciseCategories = [
    { label: 'Weight', value: 'weight' },
    { label: 'Vertical Push', value: 'vertical_push' },
    { label: 'Vertical Pull', value: 'vertical_pull' },
    { label: 'Horizontal Push', value: 'horizontal_push' },
    { label: 'Horizontal Pull', value: 'horizontal_pull' },
    { label: 'Squat', value: 'squat' },
    { label: 'Deadlift', value: 'deadlift' },
  ];

  useEffect(() => {
    if (selectedCategory) {
      loadProgressData(selectedCategory);
    }
  }, [selectedCategory]);

  // Lazy-load exercise list when switching to exercise tab
  useEffect(() => {
    if (activeTab === 'exercise' && !exercisesLoaded) {
      loadExercises();
    }
  }, [activeTab]);

  // Load exercise progress when an exercise is selected
  useEffect(() => {
    if (selectedExercise) {
      loadExerciseProgress(selectedExercise);
    }
  }, [selectedExercise]);

  const loadExercises = async () => {
    try {
      const data = await fetchExercises();
      setExercises(Array.isArray(data) ? data : []);
      setExercisesLoaded(true);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const loadExerciseProgress = async (exercise) => {
    try {
      setExerciseLoading(true);
      const data = await fetchExerciseProgress(exercise.exercise_id);

      if (!Array.isArray(data) || data.length === 0) {
        setExerciseChartData(null);
        return;
      }

      const recent = data.slice(-10);
      const labels = recent.map((e) => new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric' }));
      const weightData = recent.map((e) => Number(e.weight) || 0);
      const repsData = recent.map((e) => Number(e.reps) || 0);

      setExerciseChartData({
        labels,
        datasets: [
          { data: weightData, color: (opacity = 1) => `rgba(246, 176, 0, ${opacity})`, strokeWidth: 2 },
          { data: repsData, color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`, strokeWidth: 2 },
        ],
        legend: ['Weight (kg)', 'Reps'],
      });
    } catch (error) {
      console.error('Error fetching exercise progress:', error);
      Alert.alert('Error', 'Failed to fetch exercise progress.');
    } finally {
      setExerciseLoading(false);
    }
  };

  const loadProgressData = async (category) => {
    if (!category) return;

    try {
      setLoading(true);
      const user_id = await AsyncStorage.getItem('user_id');
      if (!user_id) {
        Alert.alert('Error', 'User ID not found');
        return;
      }

      let data = await fetchProgressData(user_id, category);

      if (!Array.isArray(data) || data.length === 0) {
        setChartData({
          labels: ['No Data'],
          datasets: [{ data: [0] }],
        });
        return;
      }

      const recentData = data.slice(-7);

      setChartData({
        labels: recentData.map((entry) => new Date(entry.date).toLocaleDateString([], { month: 'short', day: 'numeric' })),
        datasets: [{ data: recentData.map((entry) => Number(entry.weight) || 0) }],
      });
    } catch (error) {
      console.error('Error fetching progress data:', error);
      Alert.alert('Error', `Failed to fetch progress data for ${category}.`);
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = exercises.filter((e) =>
    (e.name || '').toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const renderCategoryTab = () => (
    <>
      <GlassCard style={styles.pickerCard}>
        <Text style={styles.label}>Select Category</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedCategory}
            onValueChange={(itemValue) => setSelectedCategory(itemValue)}
            style={styles.picker}
            dropdownIconColor={Theme.colors.primary}
          >
            <Picker.Item label="Choose an exercise..." value="" color={Theme.colors.textSecondary} />
            {exerciseCategories.map((exercise, index) => (
              <Picker.Item key={index} label={exercise.label} value={exercise.value} color="#fff" />
            ))}
          </Picker>
        </View>
      </GlassCard>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : chartData.labels.length > 0 && chartData.labels[0] !== 'No Data' ? (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>
            {exerciseCategories.find(c => c.value === selectedCategory)?.label} Progress
          </Text>
          <GlassCard style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={Dimensions.get('window').width - 60}
              height={260}
              chartConfig={{
                backgroundColor: Theme.colors.surface,
                backgroundGradientFrom: Theme.colors.surface,
                backgroundGradientTo: Theme.colors.surface,
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '5', strokeWidth: '2', stroke: Theme.colors.primary },
              }}
              bezier
              style={styles.chart}
            />
          </GlassCard>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Consistent progress leads to epic results. Keep pushing!</Text>
          </View>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <Text style={styles.noDataText}>
            {selectedCategory ? "No data recorded for this category yet." : "Select a category above to view your progress."}
          </Text>
        </View>
      )}
    </>
  );

  const renderExerciseTab = () => (
    <>
      <GlassCard style={styles.pickerCard}>
        <Text style={styles.label}>Search Exercise</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Type to filter..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={exerciseSearch}
          onChangeText={setExerciseSearch}
        />
        <ScrollView style={styles.exerciseList} nestedScrollEnabled>
          {filteredExercises.slice(0, 20).map((ex) => (
            <TouchableOpacity
              key={ex.exercise_id}
              style={[
                styles.exerciseItem,
                selectedExercise?.exercise_id === ex.exercise_id && styles.exerciseItemActive,
              ]}
              onPress={() => setSelectedExercise(ex)}
            >
              <Text style={[
                styles.exerciseItemText,
                selectedExercise?.exercise_id === ex.exercise_id && styles.exerciseItemTextActive,
              ]}>
                {ex.name}
              </Text>
            </TouchableOpacity>
          ))}
          {filteredExercises.length === 0 && (
            <Text style={styles.noDataText}>No exercises found.</Text>
          )}
        </ScrollView>
      </GlassCard>

      {exerciseLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : selectedExercise && exerciseChartData ? (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>{selectedExercise.name}</Text>
          <GlassCard style={styles.chartContainer}>
            <LineChart
              data={exerciseChartData}
              width={Dimensions.get('window').width - 60}
              height={260}
              chartConfig={{
                backgroundColor: Theme.colors.surface,
                backgroundGradientFrom: Theme.colors.surface,
                backgroundGradientTo: Theme.colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '4', strokeWidth: '2', stroke: Theme.colors.primary },
              }}
              bezier
              style={styles.chart}
            />
          </GlassCard>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F6B000' }]} />
              <Text style={styles.legendText}>Weight (kg)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFFFFF' }]} />
              <Text style={styles.legendText}>Reps</Text>
            </View>
          </View>
        </View>
      ) : selectedExercise && !exerciseChartData ? (
        <View style={styles.centerContent}>
          <Text style={styles.noDataText}>No data yet for {selectedExercise.name}.</Text>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <Text style={styles.noDataText}>Select an exercise above to view progress.</Text>
        </View>
      )}
    </>
  );

  return (
    <ScreenWrapper>
      <CustomHeader title="Progress Tracker" />
      <View style={styles.container}>
        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'category' && styles.tabActive]}
            onPress={() => setActiveTab('category')}
          >
            <Text style={[styles.tabText, activeTab === 'category' && styles.tabTextActive]}>By Category</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'exercise' && styles.tabActive]}
            onPress={() => setActiveTab('exercise')}
          >
            <Text style={[styles.tabText, activeTab === 'exercise' && styles.tabTextActive]}>By Exercise</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'category' ? renderCategoryTab() : renderExerciseTab()}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Theme.spacing.m,
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.l,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    backgroundColor: Theme.colors.transparentLight,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  tabText: {
    color: Theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: Theme.colors.background,
  },
  pickerCard: {
    marginBottom: Theme.spacing.l,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.s,
    fontWeight: '900',
  },
  pickerWrapper: {
    backgroundColor: Theme.colors.transparentLight,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    overflow: 'hidden',
  },
  picker: {
    height: 55,
    color: Theme.colors.text,
  },
  searchInput: {
    backgroundColor: Theme.colors.transparentLight,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    color: Theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  exerciseList: {
    maxHeight: 180,
  },
  exerciseItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  exerciseItemActive: {
    backgroundColor: 'rgba(246, 176, 0, 0.15)',
    borderRadius: Theme.borderRadius.s,
  },
  exerciseItemText: {
    color: Theme.colors.text,
    fontSize: 14,
  },
  exerciseItemTextActive: {
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  chartSection: {
    alignItems: 'center',
  },
  chartTitle: {
    ...Theme.typography.title,
    color: Theme.colors.text,
    fontSize: 18,
    marginBottom: Theme.spacing.m,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chartContainer: {
    padding: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.m,
  },
  chart: {
    borderRadius: 16,
  },
  noDataText: {
    color: Theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  infoBox: {
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.m,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  infoText: {
    color: Theme.colors.primary,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: Theme.spacing.m,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
  },
});

export default ProgressScreen;
