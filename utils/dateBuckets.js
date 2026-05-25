// G15 — pure date helpers for the volume heatmap. No React, no async.
// Sunday-start grid (matches GitHub's contribution graph convention per
// plan §8); 7 rows × N columns where the rightmost column is *this* week.

/**
 * Local-date YYYY-MM-DD string (no timezone shift). Heatmap displays
 * dates the user lived through, not UTC dates.
 */
export function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Build the heatmap grid skeleton. Returns:
 *   { columns: [[{date, key, dow, col, row}, ...]], monthLabels: [{col, label}] }
 * Column 0 = oldest week, last column = current (partial) week.
 */
export function buildHeatmapGrid(today, weeks = 52) {
    const grid = [];
    const monthLabels = [];
    const totalCols = weeks;
    const todayDow = today.getDay(); // 0 (Sun) .. 6 (Sat)

    // Anchor the first cell of the leftmost column at:
    //   today - ((weeks-1) * 7) - todayDow
    // ...so the rightmost column ends today (Sun=0 → today is row 0).
    const start = new Date(today);
    start.setDate(today.getDate() - ((totalCols - 1) * 7) - todayDow);

    let lastMonthSeen = -1;
    for (let col = 0; col < totalCols; col++) {
        const week = [];
        for (let row = 0; row < 7; row++) {
            const d = new Date(start);
            d.setDate(start.getDate() + col * 7 + row);
            week.push({
                date: d,
                key: localDateKey(d),
                dow: row,
                col,
                row,
                future: d > today,
            });
        }
        // First Sunday-of-week defines the month label for this column.
        const firstSunday = week[0].date;
        const month = firstSunday.getMonth();
        if (month !== lastMonthSeen) {
            monthLabels.push({ col, label: firstSunday.toLocaleString('default', { month: 'short' }) });
            lastMonthSeen = month;
        }
        grid.push(week);
    }
    return { columns: grid, monthLabels };
}

/** Bucket sets-count to a 0..4 intensity. */
export function intensityFor(sets) {
    if (!sets) return 0;
    if (sets <= 2) return 1;
    if (sets <= 4) return 2;
    if (sets <= 6) return 3;
    return 4;
}

/** Walking-streak in consecutive weeks with ≥1 session, working backward. */
export function computeWeekStreak(dayMap, today) {
    let streak = 0;
    const cursor = new Date(today);
    // Snap cursor to the most-recent Sunday so we count week-by-week.
    cursor.setDate(cursor.getDate() - cursor.getDay());
    for (let weekIdx = 0; weekIdx < 104; weekIdx++) {
        let weekHasSession = false;
        for (let row = 0; row < 7; row++) {
            const d = new Date(cursor);
            d.setDate(cursor.getDate() + row);
            if ((dayMap[localDateKey(d)] || 0) > 0) {
                weekHasSession = true;
                break;
            }
        }
        if (!weekHasSession) break;
        streak++;
        cursor.setDate(cursor.getDate() - 7);
    }
    return streak;
}
