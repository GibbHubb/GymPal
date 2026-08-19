// G15 — fetch + shape the volume heatmap data.
// Endpoint: GET /api/workouts/heatmap?weeks=52 → { weeks, days: [{day,sets,exercise_count}] }

import { useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeWeekStreak } from '../utils/dateBuckets';

const API_URL = 'https://gympalbackend-production.up.railway.app/api';

export function useVolumeData(weeks = 52) {
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_URL}/workouts/heatmap?weeks=${weeks}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            setDays(Array.isArray(body.days) ? body.days : []);
        } catch (err) {
            console.warn('[G15] heatmap fetch failed:', err.message);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [weeks]);

    useEffect(() => { load(); }, [load]);

    const dayMap = useMemo(() => {
        const m = {};
        for (const row of days) {
            // Backend returns ISO date strings — strip the time portion to get YYYY-MM-DD.
            const key = String(row.day).slice(0, 10);
            m[key] = { sets: row.sets || 0, exerciseCount: row.exercise_count || 0 };
        }
        return m;
    }, [days]);

    const totalSets = useMemo(
        () => days.reduce((sum, r) => sum + (r.sets || 0), 0),
        [days],
    );

    const sessionCount = useMemo(
        () => days.filter((r) => (r.sets || 0) > 0).length,
        [days],
    );

    const weekStreak = useMemo(() => computeWeekStreak(
        Object.fromEntries(Object.entries(dayMap).map(([k, v]) => [k, v.sets])),
        new Date(),
    ), [dayMap]);

    return { dayMap, totalSets, sessionCount, weekStreak, loading, error, refresh: load };
}
