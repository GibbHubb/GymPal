// G29 — Deload-week recommendation.
//
// Pure projection on top of useVolumeData: if the last 4 *completed*
// weeks each had MORE total sets than the previous one (strictly rising
// volume), recommend a deload. No new endpoint, no DB.

import { useMemo } from 'react';
import { useVolumeData } from './useVolumeData';


function weekKeyOf(d) {
    // Monday-anchored ISO-week key (YYYY-MM-DD of the Monday).
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // 0=Mon
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
}


export function useDeloadSignal() {
    const { dayMap, loading } = useVolumeData(8 * 7 / 7); // 8 weeks coverage

    const signal = useMemo(() => {
        if (loading) return { recommend: false, reason: null };

        // Roll up day-level sets into week-level totals.
        const byWeek = {};
        for (const [k, v] of Object.entries(dayMap)) {
            const wk = weekKeyOf(k);
            byWeek[wk] = (byWeek[wk] || 0) + (v.sets || 0);
        }

        // Take the last 5 completed weeks ending BEFORE the current week
        // (so we don't compare against a partial week).
        const thisWeek = weekKeyOf(new Date());
        const weeks = Object.entries(byWeek)
            .filter(([wk]) => wk < thisWeek)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-5);

        if (weeks.length < 5) return { recommend: false, reason: null };

        // 4 strictly-rising transitions across the 5 weeks => deload.
        const rising = weeks.every(
            ([, sets], i, arr) => i === 0 || sets > arr[i - 1][1],
        );
        if (!rising) return { recommend: false, reason: null };

        const last = weeks[weeks.length - 1][1];
        const first = weeks[0][1];
        return {
            recommend: true,
            reason: `Volume has risen 4 weeks in a row (${first} → ${last} sets). Consider a deload week.`,
        };
    }, [dayMap, loading]);

    return signal;
}
