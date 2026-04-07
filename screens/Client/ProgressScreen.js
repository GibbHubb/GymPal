import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { fetchProgressData } from '../../utils/api';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';

const ProgressScreen = () => {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [{ data: [] }],
  });

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

      // Limit to last 7 entries for better chart readability
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

  return (
    <ScreenWrapper>
      <CustomHeader title="Progress Tracker" />
      <View style={styles.container}>
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
                  color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`, // primary gold
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: '5',
                    strokeWidth: '2',
                    stroke: Theme.colors.primary,
                  },
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
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Theme.spacing.m,
    flex: 1,
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
  }
});

export default ProgressScreen;
