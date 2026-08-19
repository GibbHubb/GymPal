// G27 — superset / drop-set grouping convention.
//
// Carried in the existing workout_templates.exercises JSONB shape — no
// backend migration. Two new optional fields per exercise row:
//
//   group_kind: "superset" | "dropset" | undefined  (default: none)
//   group_with_previous: boolean — when true AND group_kind is set on
//       this row, this exercise is grouped with the immediately
//       previous one (and any earlier consecutive rows in the same
//       group).
//
// The TrainingScreen pairs grouped exercises with ONE rest timer
// between rounds (superset) and steps the weight down each set
// (dropset).  This util just builds the grouped view; the render
// itself lives in TrainingScreen and is intentionally minimal in v1.

/** Walk a flat list and return groups: each entry is { kind, items[] }.
 *  Ungrouped rows come back as single-item groups with kind=null. */
export function groupExercises(exercises) {
    const groups = [];
    let current = null;
    for (const ex of exercises || []) {
        const wantsGroup = !!(ex.group_with_previous && ex.group_kind);
        if (wantsGroup && current && current.kind === ex.group_kind) {
            current.items.push(ex);
            continue;
        }
        current = { kind: ex.group_kind && wantsGroup ? ex.group_kind : null, items: [ex] };
        groups.push(current);
    }
    return groups;
}

/** Round-trip-safe coercion: ensures every row carries the two new
 *  optional fields (so saving doesn't drop them server-side). */
export function withGroupingDefaults(exercises) {
    return (exercises || []).map((ex) => ({
        ...ex,
        group_kind: ex.group_kind || null,
        group_with_previous: !!ex.group_with_previous,
    }));
}

/** Human label for the group header (used by the TrainingScreen pairing
 *  UI when more than one item is present in a group). */
export function groupLabel(group) {
    if (!group?.kind || (group.items?.length || 0) < 2) return null;
    if (group.kind === 'superset') return `🔗 Superset (${group.items.length})`;
    if (group.kind === 'dropset')  return `↓ Drop-set (${group.items.length})`;
    return null;
}
