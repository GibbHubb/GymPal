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
    TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchLifestyleData, submitLifestyleData } from '../../utils/api';


const LifestyleScreen = ({ navigation }) => {
    const [stress, setStress] = useState('');
    const [sleep, setSleep] = useState('');
    const [soreness, setSoreness] = useState('');
    const [weight, setWeight] = useState('');
    const [notes, setNotes] = useState('');
    const [lifestyleData, setLifestyleData] = useState([]);
    const [alreadySubmittedToday, setAlreadySubmittedToday] = useState(false);

    useEffect(() => {
        fetchLifestyleDataHandler();
    }, []);

    const fetchLifestyleDataHandler = async () => {
        try {
            const data = await fetchLifestyleData();
            if (Array.isArray(data)) {
                setLifestyleData(data);

                // 🔍 Check if the user has already submitted today
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                const latestEntry = data[0]; // Most recent submission

                if (latestEntry && latestEntry.date.startsWith(today)) {
                    setAlreadySubmittedToday(true);
                } else {
                    setAlreadySubmittedToday(false);
                }
            } else {
                console.error('Unexpected API response:', data);
                setLifestyleData([]);
            }
        } catch (error) {
            Alert.alert('Error', error.message);
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
                        disabled={alreadySubmittedToday} // Disable if already submitted
                    >
                        <Text style={styles.selectorText}>{num}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            {/* GymPal Logo */}
            <Text style={styles.title}>Lifestyle Check-in</Text>

            {/* Selectors for Stress, Sleep, and Soreness */}
            {renderSelector("Stress", stress, setStress)}
            {renderSelector("Sleep", sleep, setSleep)}
            {renderSelector("Soreness", soreness, setSoreness)}

            <TextInput
                style={styles.input}
                placeholder="Weight"
                placeholderTextColor="#555"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                editable={!alreadySubmittedToday} // Disable if already submitted
            />
            <TextInput
                style={styles.input}
                placeholder="Notes to Trainer (Optional)"
                placeholderTextColor="#555"
                value={notes}
                onChangeText={setNotes}
                editable={!alreadySubmittedToday} // Disable if already submitted
            />

            {/* Submit Button */}
            <TouchableOpacity 
                style={[styles.button, alreadySubmittedToday && styles.disabledButton]} 
                onPress={handleSubmitLifestyleData}
                disabled={alreadySubmittedToday}  
            >
                <Text style={styles.buttonText}>
                    {alreadySubmittedToday ? 'Already Submitted Today ✅' : 'Submit'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.subtitle}>Last 3 Submissions</Text>

            {/* Display Previous Entries (Last 3 Only) */}
            <View style={styles.submissionsContainer}>
                {lifestyleData.length > 0 ? (
                    <FlatList
                        data={lifestyleData.slice(0, 3)}
                        keyExtractor={(item) => item.lifestyle_id?.toString() || Math.random().toString()}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        inverted
                        renderItem={({ item }) => (
                            <View style={styles.submissionBox}>
                                <Text style={styles.submissionDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                <Text style={styles.submissionText}>💆 Stress: {item.stress}</Text>
                                <Text style={styles.submissionText}>😴 Sleep: {item.sleep}</Text>
                                <Text style={styles.submissionText}>💪 Soreness: {item.soreness}</Text>
                                <Text style={styles.submissionText}>⚖️ Weight: {item.weight} kg</Text>
                                {item.notes_to_trainer ? <Text style={styles.submissionText}>📝 {item.notes_to_trainer}</Text> : null}
                            </View>
                        )}
                    />
                ) : (
                    <Text style={styles.noEntriesText}>No submissions yet.</Text>
                )}
            </View>
        </ScrollView>
    );
};

    const styles = StyleSheet.create({
        container: {
            flexGrow: 1,
            padding: 20,
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
        },
        logo: {
            width: 150,
            height: 80,
            resizeMode: 'contain',
            marginBottom: 20,
        },
        title: {
            fontSize: 26,
            fontWeight: 'bold',
            color: '#3274ba',
            marginBottom: 20,
        },
        input: {
            borderWidth: 1,
            padding: 12,
            marginVertical: 8,
            borderRadius: 8,
            width: '100%',
            backgroundColor: '#f8f8f8',
            borderColor: '#8ebce6',
            color: '#1A1A1A',
        },
        backButton: {
            position: 'absolute',
            top: 20,
            left: 20,
            backgroundColor: '#f7bf0b',
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            boxShadowColor: '#000',
            boxShadowOpacity: 0.1,
            boxShadowRadius: 4,
            elevation: 2,
        },
        backButtonText: {
            color: '#1A1A1A',
            fontWeight: 'bold',
            fontSize: 16,
        },
        button: {
            width: '90%',
            padding: 15,
            backgroundColor: '#f7bf0b',
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 20,
            boxShadowColor: '#000',
            boxshadowOpacity: 0.1,
            boxShadowColorhadowRadius: 6,
            elevation: 4,
        },
        buttonText: {
            color: '#1A1A1A',
            fontSize: 18,
            fontWeight: 'bold',
        },
        subtitle: {
            fontSize: 18,
            fontWeight: 'bold',
            marginTop: 20,
            color: '#3274ba',
        },
        listItem: {
            backgroundColor: '#f8f8f8',
            padding: 15,
            borderRadius: 8,
            width: '100%',
            marginVertical: 8,
            borderLeftWidth: 5,
            borderLeftColor: '#3274ba',
        },
        listText: {
            color: '#1A1A1A',
            fontSize: 16,
        },
        selectorContainer: {
            width: '50%',
            marginVertical: 10,
        },
        label: {
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 5,
            color: '#3274ba',
        },
        selectorRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        selectorButton: {
            padding: 10,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: '#3274ba',
            width: 50,
            alignItems: 'center',
        },
        selectedButton: {
            backgroundColor: '#3274ba',
        },
        selectorText: {
            fontSize: 16,
            color: '#1A1A1A',
        }, submissionsContainer: {
            width: '100%',
            marginTop: 20,
            alignItems: 'center',
        },

        submissionBox: {
            backgroundColor: '#f8f8f8',
            padding: 12,
            borderRadius: 8,
            width: 150, // Controls the size of each submission box
            marginHorizontal: 8, // Spacing between items
            alignItems: 'center',
            borderLeftWidth: 5,
            borderLeftColor: '#3274ba',
        },

        submissionDate: {
            fontSize: 14,
            fontWeight: 'bold',
            color: '#3274ba',
            marginBottom: 5,
        },

        submissionText: {
            fontSize: 14,
            color: '#1A1A1A',
            textAlign: 'center',
        },

        noEntriesText: {
            fontSize: 16,
            color: '#999',
            fontStyle: 'italic',
        },

    });

    export default LifestyleScreen;
