// G15 — single heatmap cell. Memoised so re-renders of the parent don't
// thrash the 364-cell grid; intensities precomputed in dateBuckets.

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { primaryAlpha } from '../constants/Theme';  // G53 — the one brand gold

const CELL = 12;       // px square
const GAP = 2;         // px between cells
const COLOURS = [
    'rgba(255,255,255,0.05)',  // 0 — empty
    primaryAlpha(0.30), // 1-2 sets
    primaryAlpha(0.55), // 3-4
    primaryAlpha(0.78), // 5-6
    primaryAlpha(1.00), // 7+
];

function VolumeHeatmapCell({ intensity, future, onPress, ariaLabel }) {
    if (future) {
        // Placeholder column slot for cells past today. Same footprint, no
        // colour, no tap target.
        return <View style={[styles.cell, { backgroundColor: 'transparent' }]} accessible={false} />;
    }
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button" // G61 — announces as tappable (opens the day's sets)
            accessibilityLabel={ariaLabel}
            style={[styles.cell, { backgroundColor: COLOURS[intensity] }]}
            activeOpacity={0.6}
        />
    );
}

const styles = StyleSheet.create({
    cell: {
        width: CELL, height: CELL,
        borderRadius: 2,
        marginBottom: GAP,
    },
});

VolumeHeatmapCell.CELL = CELL;
VolumeHeatmapCell.GAP = GAP;

// Memo: same intensity + same future flag → no re-render.
export default React.memo(VolumeHeatmapCell, (prev, next) => (
    prev.intensity === next.intensity && prev.future === next.future
));
