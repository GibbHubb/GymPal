// G14 — Rest-timer modal overlay. Renders when the host hook reports
// `isActive=true`; vibrates briefly when the countdown hits zero (the
// host calls `vibrateOnFire` once per fire-edge — see TrainingScreen).
//
// Design notes:
//   * Mid-screen card (not full-modal) so the user can still see the next-
//     exercise form behind it — they often want to start typing the next
//     entry while the rest is winding down.
//   * Buttons are deliberately oversized (gym phones get fat-fingered).
//   * No external sound dep — Vibration only, gracefully optional.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RestTimer({ remaining, totalSeconds, justFired, onAdjust, onSkip, onDismiss }) {
    if (justFired) {
        // "Done" state — show a brief celebration card with a Dismiss action.
        return (
            <View style={styles.overlay} pointerEvents="box-none">
                <View style={[styles.card, styles.cardDone]}>
                    <Text style={styles.doneText}>💪 Rest complete</Text>
                    <Text style={styles.doneSub}>Crush the next set</Text>
                    <TouchableOpacity onPress={onDismiss} style={styles.btnPrimary}>
                        <Text style={styles.btnPrimaryText}>Dismiss</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const pctElapsed = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
                <Text style={styles.label}>Rest</Text>
                <Text style={styles.time}>{formatTime(remaining)}</Text>

                {/* Slim progress bar */}
                <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pctElapsed * 100}%` }]} />
                </View>

                <View style={styles.row}>
                    <TouchableOpacity onPress={() => onAdjust(-15)} style={styles.btnSmall}>
                        <Text style={styles.btnSmallText}>-15s</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onAdjust(15)} style={styles.btnSmall}>
                        <Text style={styles.btnSmallText}>+15s</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onSkip} style={styles.btnSkip}>
                        <Text style={styles.btnSkipText}>Skip</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'flex-start',
        paddingTop: 80,
    },
    card: {
        backgroundColor: 'rgba(20, 20, 20, 0.92)',
        borderRadius: 16,
        paddingVertical: 16, paddingHorizontal: 20,
        minWidth: 240,
        borderWidth: 1,
        borderColor: 'rgba(246, 176, 0, 0.4)',
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    cardDone: { borderColor: '#22c55e', alignItems: 'center' },
    label: {
        fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
        color: '#94a3b8', textAlign: 'center', marginBottom: 4,
    },
    time: {
        fontFamily: 'ui-monospace',
        fontSize: 44, fontWeight: '800',
        color: Theme?.colors?.primary || '#F6B000',
        textAlign: 'center', marginBottom: 8,
    },
    barTrack: {
        height: 4, width: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2, overflow: 'hidden', marginBottom: 14,
    },
    barFill: {
        height: '100%',
        backgroundColor: Theme?.colors?.primary || '#F6B000',
    },
    row: {
        flexDirection: 'row', justifyContent: 'space-between', gap: 8,
    },
    btnSmall: {
        flex: 1,
        paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
    },
    btnSmallText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
    btnSkip: {
        flex: 1,
        paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(248, 113, 113, 0.18)',
        borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.35)',
        alignItems: 'center',
    },
    btnSkipText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
    doneText: {
        fontSize: 20, fontWeight: '700',
        color: '#22c55e', marginBottom: 2,
    },
    doneSub: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
    btnPrimary: {
        paddingVertical: 10, paddingHorizontal: 24,
        borderRadius: 10,
        backgroundColor: Theme?.colors?.primary || '#F6B000',
    },
    btnPrimaryText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
