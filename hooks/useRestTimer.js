// G14 — Rest-timer state hook. Foreground-only countdown driven by an
// 800 ms tick (close enough for a visual countdown, gentle on RN's event
// loop). Uses `started_at + duration` as the source of truth so the visible
// remaining seconds always match wall-clock — no drift even if the JS
// thread stutters.
//
// API:
//   const t = useRestTimer();
//   t.start(seconds)         // begin a fresh countdown
//   t.adjust(deltaSeconds)   // +15 / -15
//   t.skip()                 // dismiss without firing
//   t.dismiss()              // dismiss after firing
//   t.remaining              // seconds left (0 when finished)
//   t.isActive               // any countdown running?
//   t.justFired              // briefly true once when remaining hits 0;
//                            // consumers vibrate/play sound on this edge

import { useEffect, useRef, useState } from 'react';

export function useRestTimer() {
    const [state, setState] = useState({ startedAt: null, totalSeconds: 0, dismissed: true });
    const [tick, setTick] = useState(0);
    const firedRef = useRef(false);

    useEffect(() => {
        if (state.dismissed) return;
        const interval = setInterval(() => setTick((n) => n + 1), 800);
        return () => clearInterval(interval);
    }, [state.dismissed]);

    const remaining = (() => {
        if (state.dismissed || state.startedAt == null) return 0;
        const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
        return Math.max(0, state.totalSeconds - elapsed);
    })();

    const justFired = !state.dismissed && remaining === 0 && !firedRef.current;
    if (justFired) firedRef.current = true;

    const start = (seconds) => {
        firedRef.current = false;
        setState({ startedAt: Date.now(), totalSeconds: Math.max(15, Math.min(900, seconds)), dismissed: false });
        setTick(0);
    };

    const adjust = (delta) => {
        setState((s) => {
            if (s.dismissed) return s;
            return { ...s, totalSeconds: Math.max(15, Math.min(900, s.totalSeconds + delta)) };
        });
    };

    const skip = () => {
        firedRef.current = true;
        setState({ startedAt: null, totalSeconds: 0, dismissed: true });
    };

    const dismiss = skip; // same effect — clears the overlay

    return {
        remaining,
        totalSeconds: state.totalSeconds,
        isActive:    !state.dismissed,
        justFired,
        start,
        adjust,
        skip,
        dismiss,
    };
}

// Reference unused-tick to keep ESLint happy — its sole purpose is to
// trigger re-renders so `remaining` recomputes.
useRestTimer._consumed = (t) => t;
