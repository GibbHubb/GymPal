// G16 — Program week×day grid editor + assign-to-client flow.
//
// Layout: rows = days (Sun..Sat), cols = weeks. Each cell shows the
// template name (or "—" empty). Tapping a cell opens a picker with the
// trainer's templates + a Clear option.
//
// Bottom: "Assign to client" → prompts for client username + start date,
// posts /api/programs/:id/assign.

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Modal,
    TextInput, Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomButton from '../../components/CustomButton';
import {
    fetchProgramDetail, upsertProgramDay, assignProgram, fetchTemplates,
} from '../../api';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProgramBuilderScreen() {
    const navigation = useNavigation();
    const { params } = useRoute();
    const programId = params?.programId;

    const [program, setProgram] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pickerCell, setPickerCell] = useState(null); // {week, dow}
    const [showAssign, setShowAssign] = useState(false);
    const [assignUsername, setAssignUsername] = useState('');
    const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [assigning, setAssigning] = useState(false);

    const load = useCallback(async () => {
        try {
            const [prog, tpls] = await Promise.all([
                fetchProgramDetail(programId),
                fetchTemplates(),
            ]);
            setProgram(prog);
            setTemplates(tpls);
        } catch (err) {
            Alert.alert('Error', 'Could not load program.');
        } finally {
            setLoading(false);
        }
    }, [programId]);

    useEffect(() => { load(); }, [load]);

    // Build a sparse map: `${week}-${dow}` → day-row
    const cellMap = {};
    (program?.days || []).forEach((d) => {
        cellMap[`${d.week_number}-${d.day_of_week}`] = d;
    });

    const updateCell = async (week, dow, templateId) => {
        try {
            await upsertProgramDay(programId, {
                week_number: week, day_of_week: dow, template_id: templateId,
            });
            // Optimistic local refresh
            const filtered = (program.days || []).filter(
                (d) => !(d.week_number === week && d.day_of_week === dow)
            );
            const tpl = templates.find((t) => t.id === templateId);
            const newDays = templateId
                ? [...filtered, {
                    week_number: week, day_of_week: dow,
                    template_id: templateId, template_name: tpl?.name || '?',
                }]
                : filtered;
            setProgram({ ...program, days: newDays });
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not update cell.');
        } finally {
            setPickerCell(null);
        }
    };

    const handleAssign = async () => {
        // Plan §8 deferred a real client picker — for v1, accept a numeric
        // user_id directly so testing on TestFlight works without a search UI.
        const id = parseInt(assignUsername.trim(), 10);
        if (!id) return Alert.alert('Client', 'Enter the numeric client_id (find it in the trainer dashboard).');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(assignDate.trim())) {
            return Alert.alert('Date', 'Start date must be YYYY-MM-DD.');
        }
        setAssigning(true);
        try {
            await assignProgram(programId, { client_id: id, start_date: assignDate.trim() });
            setShowAssign(false);
            Alert.alert('Assigned', `Program assigned. Today's session resolves from ${assignDate}.`);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Assign failed.');
        } finally {
            setAssigning(false);
        }
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

    if (!program) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <Text style={{ color: Theme.colors.text }}>Program not found.</Text>
                </View>
            </ScreenWrapper>
        );
    }

    const weeks = Array.from({ length: program.total_weeks }, (_, i) => i + 1);

    return (
        <ScreenWrapper scrollable={false}>
            <View style={styles.header}>
                <Text style={styles.title}>{program.name}</Text>
                <Text style={styles.subtitle}>{program.total_weeks} weeks · tap a cell to assign a template</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
                <View>
                    {/* Header row: week numbers */}
                    <View style={styles.gridRow}>
                        <View style={[styles.headCell, styles.dowHead]} />
                        {weeks.map((w) => (
                            <View key={w} style={[styles.headCell, styles.weekHead]}>
                                <Text style={styles.headText}>W{w}</Text>
                            </View>
                        ))}
                    </View>
                    {/* One row per day-of-week */}
                    {DOW_LABELS.map((label, dow) => (
                        <View style={styles.gridRow} key={dow}>
                            <View style={[styles.headCell, styles.dowHead]}>
                                <Text style={styles.headText}>{label}</Text>
                            </View>
                            {weeks.map((w) => {
                                const cell = cellMap[`${w}-${dow}`];
                                return (
                                    <TouchableOpacity
                                        key={w}
                                        style={[styles.cell, cell ? styles.cellFilled : null]}
                                        onPress={() => setPickerCell({ week: w, dow })}
                                    >
                                        <Text style={styles.cellText} numberOfLines={1}>
                                            {cell ? cell.template_name : '—'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.actionBar}>
                <CustomButton title="👥 Assign to client" onPress={() => setShowAssign(true)} />
            </View>

            {/* Template picker */}
            <Modal visible={!!pickerCell} animationType="fade" transparent onRequestClose={() => setPickerCell(null)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPickerCell(null)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            Pick a template — Week {pickerCell?.week}, {DOW_LABELS[pickerCell?.dow ?? 0]}
                        </Text>
                        <ScrollView style={{ maxHeight: 320 }}>
                            <TouchableOpacity
                                style={styles.modalRow}
                                onPress={() => updateCell(pickerCell.week, pickerCell.dow, null)}
                            >
                                <Text style={[styles.modalRowText, { color: '#fca5a5' }]}>✕ Clear (rest day)</Text>
                            </TouchableOpacity>
                            {templates.length === 0 && (
                                <Text style={styles.empty}>No templates yet. Create one in the workout builder first.</Text>
                            )}
                            {templates.map((t) => (
                                <TouchableOpacity
                                    key={t.id}
                                    style={styles.modalRow}
                                    onPress={() => updateCell(pickerCell.week, pickerCell.dow, t.id)}
                                >
                                    <Text style={styles.modalRowText}>{t.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Assign modal */}
            <Modal visible={showAssign} animationType="fade" transparent onRequestClose={() => setShowAssign(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAssign(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Assign program</Text>
                        <Text style={styles.label}>Client user_id</Text>
                        <TextInput
                            keyboardType="number-pad"
                            placeholder="123"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={styles.input}
                            value={assignUsername}
                            onChangeText={setAssignUsername}
                        />
                        <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
                        <TextInput
                            placeholder="2026-05-12"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={styles.input}
                            value={assignDate}
                            onChangeText={setAssignDate}
                            autoCapitalize="none"
                        />
                        <CustomButton
                            title={assigning ? 'Assigning…' : 'Assign'}
                            onPress={handleAssign}
                            style={{ marginTop: Theme.spacing.s }}
                        />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </ScreenWrapper>
    );
}

const CELL_W = 80;
const CELL_H = 56;
const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { padding: Theme.spacing.l, paddingBottom: Theme.spacing.s },
    title: { ...Theme.typography.title, color: Theme.colors.primary },
    subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
    gridScroll: { padding: Theme.spacing.l },
    gridRow: { flexDirection: 'row', marginBottom: 4 },
    headCell: {
        width: CELL_W, height: CELL_H,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 6,
        marginRight: 4,
    },
    dowHead: { backgroundColor: 'rgba(255,255,255,0.05)' },
    weekHead: { backgroundColor: 'rgba(246,176,0,0.12)' },
    headText: { color: Theme.colors.text, fontWeight: '700', fontSize: 12 },
    cell: {
        width: CELL_W, height: CELL_H,
        marginRight: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 4,
    },
    cellFilled: {
        backgroundColor: 'rgba(246, 176, 0, 0.18)',
        borderColor: 'rgba(246, 176, 0, 0.4)',
    },
    cellText: { color: Theme.colors.text, fontSize: 11, textAlign: 'center' },
    actionBar: {
        padding: Theme.spacing.l, paddingTop: Theme.spacing.s,
    },
    modalBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: Theme.spacing.l,
    },
    modalCard: {
        width: '100%', maxWidth: 360,
        backgroundColor: '#1e293b',
        borderRadius: 12, padding: Theme.spacing.l,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: Theme.spacing.m },
    modalRow: {
        paddingVertical: 12, paddingHorizontal: 8,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    modalRowText: { color: Theme.colors.text, fontSize: 14 },
    label: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginTop: Theme.spacing.s, marginBottom: 4,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        color: Theme.colors.text,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 8, fontSize: 14,
    },
    empty: {
        color: 'rgba(255,255,255,0.5)', textAlign: 'center',
        padding: Theme.spacing.m, fontStyle: 'italic',
    },
});
