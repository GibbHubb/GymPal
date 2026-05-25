// G15 — 52-week × 7-day GitHub-style training heatmap.
//
// * Horizontal-scroll wrap so the grid never overflows screen width.
// * Selected cell shows a small detail panel below (date + sets + exercises).
// * Summary strip across the bottom: "X sessions in last 52 weeks · Y total sets · longest streak Z weeks".
// * Empty state when the user has zero sessions.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';
import { useVolumeData } from '../hooks/useVolumeData';
import { buildHeatmapGrid, intensityFor, localDateKey } from '../utils/dateBuckets';
import VolumeHeatmapCell from './VolumeHeatmapCell';

const WEEKS = 52;
const COL_W = VolumeHeatmapCell.CELL + VolumeHeatmapCell.GAP;

export default function VolumeHeatmap() {
    const { dayMap, totalSets, sessionCount, weekStreak, loading } = useVolumeData(WEEKS);
    const [selected, setSelected] = useState(null); // {key, label, sets, exerciseCount}
    const [today] = useState(() => new Date());

    const { columns, monthLabels } = useMemo(
        () => buildHeatmapGrid(today, WEEKS),
        [today],
    );

    // Auto-select today on first render so the detail panel has a default
    // value to show (less awkward than blank state).
    useEffect(() => {
        if (selected || loading) return;
        const todayKey = localDateKey(today);
        const day = dayMap[todayKey];
        if (day) {
            setSelected({
                key: todayKey,
                label: today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
                sets: day.sets,
                exerciseCount: day.exerciseCount,
            });
        }
    }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCellPress = (cell) => {
        const day = dayMap[cell.key];
        const sets = day?.sets || 0;
        const exerciseCount = day?.exerciseCount || 0;
        setSelected({
            key: cell.key,
            label: cell.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
            sets,
            exerciseCount,
        });
    };

    const empty = !loading && sessionCount === 0;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Training intensity</Text>
                <Text style={styles.subtitle}>
                    last 52 weeks
                </Text>
            </View>

            {empty ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Log your first set to light this up. 💪</Text>
                </View>
            ) : (
                <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                        <View>
                            {/* Month label row */}
                            <View style={[styles.monthRow, { width: WEEKS * COL_W }]}>
                                {monthLabels.map(({ col, label }) => (
                                    <Text
                                        key={`${col}-${label}`}
                                        style={[styles.monthLabel, { left: col * COL_W }]}
                                    >
                                        {label}
                                    </Text>
                                ))}
                            </View>
                            {/* Grid */}
                            <View style={styles.grid}>
                                {columns.map((week, ci) => (
                                    <View key={ci} style={{ marginRight: VolumeHeatmapCell.GAP }}>
                                        {week.map((cell) => {
                                            const sets = dayMap[cell.key]?.sets || 0;
                                            return (
                                                <VolumeHeatmapCell
                                                    key={cell.key}
                                                    intensity={intensityFor(sets)}
                                                    future={cell.future}
                                                    onPress={() => handleCellPress(cell)}
                                                    ariaLabel={`${cell.key}: ${sets} sets`}
                                                />
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    {selected && (
                        <View style={styles.detail}>
                            <Text style={styles.detailDate}>{selected.label}</Text>
                            <Text style={styles.detailMeta}>
                                {selected.sets > 0
                                    ? `${selected.sets} set${selected.sets === 1 ? '' : 's'}`
                                    : 'rest day'}
                                {selected.exerciseCount > 0 ? ` · ${selected.exerciseCount} exercise${selected.exerciseCount === 1 ? '' : 's'}` : ''}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.summary}>
                        {sessionCount} session{sessionCount === 1 ? '' : 's'} ·{' '}
                        {totalSets} total set{totalSets === 1 ? '' : 's'} ·{' '}
                        longest streak {weekStreak} week{weekStreak === 1 ? '' : 's'}
                    </Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: Theme.spacing.l,
        paddingVertical: Theme.spacing.m,
        paddingHorizontal: Theme.spacing.m,
        borderRadius: Theme.borderRadius?.l || 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        width: '100%',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: Theme.spacing.s,
    },
    title: {
        color: Theme.colors.text,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
    scroll: {
        paddingBottom: Theme.spacing.s,
    },
    monthRow: {
        height: 16,
        position: 'relative',
        marginBottom: 4,
    },
    monthLabel: {
        position: 'absolute',
        top: 0,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
    },
    grid: {
        flexDirection: 'row',
    },
    detail: {
        marginTop: Theme.spacing.m,
        paddingTop: Theme.spacing.s,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    detailDate: {
        color: Theme.colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    detailMeta: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 2,
    },
    summary: {
        marginTop: Theme.spacing.m,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        textAlign: 'center',
    },
    emptyBox: {
        paddingVertical: Theme.spacing.l,
        alignItems: 'center',
    },
    emptyText: {
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
        fontSize: 13,
    },
});
