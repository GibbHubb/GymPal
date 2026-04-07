import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Alert,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    TextInput,
    ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchLifestyleData, submitLifestyleData } from '../../utils/api';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';
import CustomButton from '../../components/CustomButton';

const LifestyleScreen = ({ navigation }) => {
    const [stress, setStress] = useState('');
    const [sleep, setSleep] = useState('');
    const [soreness, setSoreness] = useState('');
    const [weight, setWeight] = useState('');
    const [notes, setNotes] = useState('');
    const [lifestyleData, setLifestyleData] = useState([]);
    const [alreadySubmittedToday, setAlreadySubmittedToday] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLifestyleDataHandler();
    }, []);

    const fetchLifestyleDataHandler = async () => {
        try {
            setLoading(true);
            const data = await fetchLifestyleData();
            if (Array.isArray(data)) {
                setLifestyleData(data);

                const today = new Date().toISOString().split('T')[0];
                const latestEntry = data[0];

                if (latestEntry && latestEntry.date.startsWith(today)) {
                    setAlreadySubmittedToday(true);
                } else {
                    setAlreadySubmittedToday(false);
                }
            } else {
                setLifestyleData([]);
            }
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitLifestyleData = async () => {
        if (alreadySubmittedToday) {
            Alert.alert('📛 Submission Blocked', 'You have already submitted your lifestyle check-in for today.');
            return;
        }
    
        if (!stress || !sleep || !soreness || !weight) {
            Alert.alert('❌ Error', 'Please fill in all fields before submitting.');
            return;
        }
    
        try {
            await submitLifestyleData({ stress, sleep, soreness, weight, notes_to_trainer: notes });
    
            Alert.alert(
                '✅ Submitted Successfully',
                'Your lifestyle check-in has been saved!',
                [{ text: 'OK', onPress: fetchLifestyleDataHandler }]
            );
    
            setNotes('');
        } catch (error) {
            Alert.alert('❌ Error', error.message || 'Something went wrong while submitting.');
        }
    };

    const renderSelector = (label, value, setValue) => (
        <View style={styles.selectorContainer}>
            <Text style={styles.label}>{label}:</Text>
            <View style={styles.selectorRow}>
                {[1, 2, 3].map((num) => (
                    <TouchableOpacity
                        key={num}
                        style={[
                            styles.selectorButton,
                            value == num && styles.selectedButton
                        ]}
                        onPress={() => setValue(num)}
                        disabled={alreadySubmittedToday}
                    >
                        <Text style={[styles.selectorText, value == num && styles.selectedSelectorText]}>{num}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    if (loading) {
        return (
            <ScreenWrapper>
                <CustomHeader title="Lifestyle Check-in" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Theme.colors.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scrollable={true}>
            <CustomHeader title="Lifestyle Check-in" />
            <View style={styles.container}>
                <GlassCard style={styles.formCard}>
                    {renderSelector("Stress", stress, setStress)}
                    {renderSelector("Sleep", sleep, setSleep)}
                    {renderSelector("Soreness", soreness, setSoreness)}

                    <TextInput
                        style={styles.input}
                        placeholder="Weight (kg)"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                        editable={!alreadySubmittedToday}
                    />
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                        placeholder="Notes to Trainer (Optional)"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        editable={!alreadySubmittedToday}
                    />

                    <CustomButton 
                        title={alreadySubmittedToday ? 'Already Submitted Today ✅' : 'Submit Check-in'} 
                        onPress={handleSubmitLifestyleData}
                        disabled={alreadySubmittedToday}
                        style={[styles.submitButton, alreadySubmittedToday && styles.disabledButton]}
                    />
                </GlassCard>

                <Text style={styles.subtitle}>Recent Submissions</Text>

                <View style={styles.submissionsContainer}>
                    {lifestyleData.length > 0 ? (
                        <FlatList
                            data={lifestyleData.slice(0, 5)}
                            keyExtractor={(item) => item.lifestyle_id?.toString() || Math.random().toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <GlassCard style={styles.submissionBox}>
                                    <Text style={styles.submissionDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                    <View style={styles.submissionStats}>
                                        <Text style={styles.submissionText}>💆 Stress: {item.stress}</Text>
                                        <Text style={styles.submissionText}>😴 Sleep: {item.sleep}</Text>
                                        <Text style={styles.submissionText}>💪 Soreness: {item.soreness}</Text>
                                        <Text style={styles.submissionText}>⚖️ {item.weight} kg</Text>
                                    </View>
                                </GlassCard>
                            )}
                        />
                    ) : (
                        <Text style={styles.noEntriesText}>No submissions yet.</Text>
                    )}
                </View>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: Theme.spacing.m,
        backgroundColor: Theme.colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    formCard: {
        marginBottom: Theme.spacing.l,
    },
    title: {
        ...Theme.typography.header,
        color: Theme.colors.primary,
        fontSize: 24,
        textAlign: 'center',
        marginBottom: Theme.spacing.l,
    },
    input: {
        backgroundColor: Theme.colors.transparentLight,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        borderRadius: Theme.borderRadius.m,
        padding: Theme.spacing.m,
        color: Theme.colors.text,
        marginVertical: Theme.spacing.s,
    },
    submitButton: {
        marginTop: Theme.spacing.m,
    },
    disabledButton: {
        opacity: 0.6,
        backgroundColor: Theme.colors.surface,
    },
    subtitle: {
        ...Theme.typography.title,
        color: Theme.colors.primary,
        fontSize: 18,
        marginBottom: Theme.spacing.m,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    selectorContainer: {
        marginVertical: Theme.spacing.s,
    },
    label: {
        ...Theme.typography.caption,
        color: Theme.colors.textSecondary,
        marginBottom: Theme.spacing.s,
    },
    selectorRow: {
        flexDirection: 'row',
        gap: Theme.spacing.m,
    },
    selectorButton: {
        width: 60,
        height: 50,
        borderRadius: Theme.borderRadius.m,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedButton: {
        backgroundColor: Theme.colors.primary,
        borderColor: Theme.colors.primary,
        ...Theme.shadows.glow,
    },
    selectorText: {
        color: Theme.colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    selectedSelectorText: {
        color: '#000',
    },
    submissionsContainer: {
        width: '100%',
        marginTop: Theme.spacing.s,
    },
    submissionBox: {
        width: 180,
        marginRight: Theme.spacing.m,
        padding: Theme.spacing.m,
    },
    submissionDate: {
        ...Theme.typography.caption,
        color: Theme.colors.primary,
        fontWeight: '900',
        marginBottom: Theme.spacing.s,
        textAlign: 'center',
    },
    submissionStats: {
        gap: 4,
    },
    submissionText: {
        color: Theme.colors.text,
        fontSize: 13,
    },
    noEntriesText: {
        color: Theme.colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: Theme.spacing.l,
    },
});

export default LifestyleScreen;
