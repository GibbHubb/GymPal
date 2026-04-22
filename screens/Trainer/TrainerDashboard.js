import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Theme } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';
import { getClientStats } from '../../utils/api';

/**
 * G11 — Trainer client dashboard
 * Single-glance view of every client:
 *   - last session date, workout streak, total sessions
 *   - red "inactive" badge for clients with no session in the last 7 days
 * Sort: inactive first, then active by most recent last_session desc.
 */
export default function TrainerDashboard() {
  const navigation = useNavigation();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      setError(null);
      const data = await getClientStats();
      setStats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading client stats:', err);
      setError('Failed to load client stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Refresh every time this screen becomes focused so new sessions surface
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const formatLastSession = (dateStr, daysSince) => {
    if (!dateStr) return 'No sessions yet';
    if (daysSince === 0) return 'Today';
    if (daysSince === 1) return 'Yesterday';
    if (daysSince < 7) return `${daysSince}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.cardTouchable}
      onPress={() => navigation.navigate('ProfileScreen', { userId: item.user_id })}
    >
      <GlassCard style={[styles.card, item.inactive && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
          {item.inactive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
            </View>
          )}
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{item.total_sessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{item.streak}</Text>
            <Text style={styles.statLabel}>Week Streak</Text>
          </View>
          <View style={styles.statCellWide}>
            <Text style={styles.statValue}>
              {formatLastSession(item.last_session, item.days_since)}
            </Text>
            <Text style={styles.statLabel}>Last Session</Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <CustomHeader title="Client Dashboard" />
      <View style={styles.container}>
        {loading && !refreshing ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadStats}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : stats.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>No clients yet.</Text>
          </View>
        ) : (
          <FlatList
            data={stats}
            keyExtractor={(item) => String(item.user_id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Theme.colors.primary}
              />
            }
          />
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Theme.spacing.m,
  },
  listContent: {
    paddingBottom: Theme.spacing.xl,
  },
  cardTouchable: {
    marginBottom: Theme.spacing.m,
  },
  card: {
    padding: Theme.spacing.m,
  },
  cardInactive: {
    borderColor: Theme.colors.error,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.m,
  },
  username: {
    flex: 1,
    color: Theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  inactiveBadge: {
    backgroundColor: Theme.colors.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  inactiveBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statCellWide: {
    flex: 1.4,
    alignItems: 'center',
  },
  statValue: {
    color: Theme.colors.primary,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    color: Theme.colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Theme.colors.textSecondary,
    fontSize: 16,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 14,
    marginBottom: Theme.spacing.m,
  },
  retryBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.l,
    paddingVertical: Theme.spacing.s,
    borderRadius: Theme.borderRadius.m,
  },
  retryText: {
    color: Theme.colors.background,
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
  },
});
