// G31 — Public weekly leaderboard (opt-in).
// Cohort is same-trainer co-clients; non-opted-in users never appear.
// Shows the user their own opt-in state with a toggle (default opt-out).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { authApi } from '../../api';  // G47 review
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';



export default function LeaderboardScreen() {
  const [rows, setRows] = useState([]);
  const [optedIn, setOptedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await authApi.get('/leaderboard/weekly');  // G47 review — refresh-aware client
      setRows(body.rows || []);
      setOptedIn(!!body.opted_in);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleOptIn = async () => {
    const next = !optedIn;
    try {
      await authApi.patch('/leaderboard/opt-in', { opt_in: next });  // G47 review — refresh-aware client
      setOptedIn(next);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ScreenWrapper>
      <CustomHeader title="Weekly Leaderboard" />
      <View style={styles.body}>
        <GlassCard style={styles.card}>
          <Text style={styles.intro}>
            {optedIn
              ? 'You are visible on the leaderboard (same trainer\'s clients).'
              : 'You are NOT visible on the leaderboard. Opt in to appear and to see other opted-in clients of your trainer.'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={optedIn ? 'Opt out of the leaderboard' : 'Opt in to the leaderboard'}
            onPress={toggleOptIn}
            style={[styles.optButton, optedIn ? styles.optOutButton : styles.optInButton]}
          >
            <Text style={optedIn ? styles.optOutText : styles.optInText}>
              {optedIn ? 'Opt out' : 'Opt in to leaderboard'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {loading && <ActivityIndicator size="large" color={Theme.colors.primary} />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {!loading && rows.length === 0 && (
          <Text style={styles.emptyText}>
            No opted-in clients in your trainer's cohort yet.
          </Text>
        )}
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.user_id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>
                #{item.rank}
              </Text>
              <Text style={styles.name}>
                {item.username}
              </Text>
              <Text style={styles.meta}>
                {item.sets} sets · {item.reps} reps
              </Text>
            </View>
          )}
        />
      </View>
    </ScreenWrapper>
  );
}

// G62 — named styles (were inline) so scripts/contrast_audit.mjs can read the text AND the
// background of each pair from here. The opt-in/out button used white text on gold (1.69:1) and on
// #FF4C4C (3.3:1): gold now carries dark text, opt-out uses the strong red fill under white.
const styles = StyleSheet.create({
  body: { flex: 1, padding: Theme.spacing.m },
  card: { padding: Theme.spacing.m, marginBottom: Theme.spacing.m },
  intro: { color: Theme.colors.text, marginBottom: 8 },
  optButton: { padding: 10, borderRadius: 6, alignItems: 'center' },
  optInButton: { backgroundColor: Theme.colors.primary },
  optOutButton: { backgroundColor: Theme.colors.dangerStrong },
  optInText: { color: Theme.colors.onPrimary, fontWeight: '700' },
  optOutText: { color: '#FFFFFF', fontWeight: '700' },
  errorText: { color: Theme.colors.error },
  emptyText: { color: Theme.colors.textSecondary },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 6,
  },
  rank: { color: Theme.colors.primary, fontWeight: '900', width: 36 },
  name: { color: Theme.colors.text, flex: 1, textTransform: 'capitalize' },
  meta: { color: Theme.colors.textSecondary },
});
