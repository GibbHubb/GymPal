// G16 — Trainer's saved programs. Tap → ProgramBuilder; "+" → create.
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    Alert, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomButton from '../../components/CustomButton';
import { fetchPrograms, createProgram, deleteProgram } from '../../api';

export default function ProgramsListScreen() {
    const navigation = useNavigation();
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newWeeks, setNewWeeks] = useState('4');

    const load = useCallback(async () => {
        try {
            const data = await fetchPrograms();
            setPrograms(data);
        } catch (err) {
            Alert.alert('Error', 'Could not load programs.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handleCreate = async () => {
        const n = newName.trim();
        const w = parseInt(newWeeks, 10);
        if (!n) return Alert.alert('Missing', 'Give the program a name.');
        if (!w || w < 1 || w > 52) return Alert.alert('Weeks', 'Pick a number between 1 and 52.');
        setCreating(true);
        try {
            const created = await createProgram({ name: n, total_weeks: w });
            setNewName(''); setNewWeeks('4');
            navigation.navigate('ProgramBuilder', { programId: created.id });
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not create the program.');
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = (program) => {
        Alert.alert('Delete program', `Delete "${program.name}"? This is permanent.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteProgram(program.id);
                        setPrograms((prev) => prev.filter((p) => p.id !== program.id));
                    } catch {
                        Alert.alert('Error', 'Could not delete.');
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Theme.colors.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scrollable={false}>
            <View style={styles.header}>
                <Text style={styles.title}>📅 Programs</Text>
            </View>

            <View style={styles.createBox}>
                <Text style={styles.sectionLabel}>New program</Text>
                <TextInput
                    placeholder="e.g. Push/Pull/Legs"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.input}
                    value={newName}
                    onChangeText={setNewName}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.s }}>
                    <Text style={styles.inlineLabel}>Weeks:</Text>
                    <TextInput
                        keyboardType="number-pad"
                        style={[styles.input, { width: 80 }]}
                        value={newWeeks}
                        onChangeText={setNewWeeks}
                    />
                </View>
                <CustomButton
                    title={creating ? 'Creating…' : 'Create + open builder'}
                    onPress={handleCreate}
                    style={{ marginTop: Theme.spacing.s }}
                />
            </View>

            <FlatList
                data={programs}
                keyExtractor={(p) => String(p.id)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
                contentContainerStyle={{ paddingBottom: Theme.spacing.xl }}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        No programs yet. Build one above.
                    </Text>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => navigation.navigate('ProgramBuilder', { programId: item.id })}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{item.name}</Text>
                            <Text style={styles.rowMeta}>{item.total_weeks} week{item.total_weeks === 1 ? '' : 's'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={12}>
                            <Text style={styles.del}>✕</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { padding: Theme.spacing.l, paddingBottom: Theme.spacing.s },
    title: { ...Theme.typography.title, color: Theme.colors.primary },
    sectionLabel: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginBottom: Theme.spacing.s,
    },
    inlineLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
    createBox: {
        marginHorizontal: Theme.spacing.l,
        marginBottom: Theme.spacing.l,
        padding: Theme.spacing.m,
        borderRadius: Theme.borderRadius?.l || 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        gap: Theme.spacing.s,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        color: Theme.colors.text,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 8, fontSize: 14,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: Theme.spacing.l,
        marginBottom: Theme.spacing.s,
        padding: Theme.spacing.m,
        borderRadius: Theme.borderRadius?.l || 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    rowTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '600' },
    rowMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
    del: { color: '#fca5a5', fontSize: 18, paddingHorizontal: 8 },
    empty: {
        color: 'rgba(255,255,255,0.5)', textAlign: 'center',
        marginTop: Theme.spacing.xl, fontSize: 13, fontStyle: 'italic',
    },
});
