// G31 — Public weekly leaderboard (opt-in).
// Cohort is same-trainer co-clients; non-opted-in users never appear.
// Shows the user their own opt-in state with a toggle (default opt-out).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';

const API_URL = 'https://gympalbackend-production.up.railway.app/api';


export default function LeaderboardScreen() {
  const [rows, setRows] = useState([]);
  const [optedIn, setOptedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/leaderboard/weekly`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
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
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/leaderboard/opt-in`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opt_in: next }),
      });
      setOptedIn(next);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ScreenWrapper>
      <CustomHeader title="Weekly Leaderboard" />
      <View style={{ flex: 1, padding: Theme.spacing.m }}>
        <GlassCard style={{ padding: Theme.spacing.m, marginBottom: Theme.spacing.m }}>
          <Text style={{ color: Theme.colors.text, marginBottom: 8 }}>
            {optedIn
              ? 'You are visible on the leaderboard (same trainer\'s clients).'
              : 'You are NOT visible on the leaderboard. Opt in to appear and to see other opted-in clients of your trainer.'}
          </Text>
          <TouchableOpacity
            onPress={toggleOptIn}
            style={{
              backgroundColor: optedIn ? Theme.colors.error : Theme.colors.primary,
              padding: 10, borderRadius: 6, alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {optedIn ? 'Opt out' : 'Opt in to leaderboard'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {loading && <ActivityIndicator size="large" color={Theme.colors.primary} />}
        {error && <Text style={{ color: Theme.colors.error }}>{error}</Text>}
        {!loading && rows.length === 0 && (
          <Text style={{ color: Theme.colors.textSecondary }}>
            No opted-in clients in your trainer's cohort yet.
          </Text>
        )}
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.user_id)}
          renderItem={({ item }) => (
            <View style={{
              flexDirection: 'row', alignItems: 'center', padding: 10,
              backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 6,
            }}>
              <Text style={{ color: Theme.colors.primary, fontWeight: '900', width: 36 }}>
                #{item.rank}
              </Text>
              <Text style={{ color: Theme.colors.text, flex: 1, textTransform: 'capitalize' }}>
                {item.username}
              </Text>
              <Text style={{ color: Theme.colors.textSecondary }}>
                {item.sets} sets · {item.reps} reps
              </Text>
            </View>
          )}
        />
      </View>
    </ScreenWrapper>
  );
}
