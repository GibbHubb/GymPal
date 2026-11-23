// G12 — Trainer's "Manage Clients" screen.
// Add a client by username, archive (soft-remove), unarchive, or hard-delete.
// Active list feeds every other trainer-side query via the trainer_clients
// pivot — see `getClientStats` in workoutsController.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Theme, primaryAlpha } from '../../constants/Theme';
import ScreenWrapper from '../../components/ScreenWrapper';
import CustomHeader from '../../components/CustomHeader';
import GlassCard from '../../components/GlassCard';
import {
  fetchTrainerClients,
  addTrainerClient,
  updateTrainerClient,
  deleteTrainerClient,
} from '../../api';
import { say } from '../../utils/a11yText';  // G61

export default function ClientsManagementScreen() {
  const [active, setActive] = useState([]);
  const [archived, setArchived] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [username, setUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, ar] = await Promise.all([
        fetchTrainerClients('active'),
        fetchTrainerClients('archived'),
      ]);
      setActive(Array.isArray(a) ? a : []);
      setArchived(Array.isArray(ar) ? ar : []);
    } catch (err) {
      console.error('Load clients failed:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleAdd = async () => {
    const u = username.trim();
    if (!u) return;
    setAdding(true);
    try {
      await addTrainerClient(u);
      setUsername('');
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not add that client.';
      Alert.alert('Add failed', msg);
    } finally {
      setAdding(false);
    }
  };

  const handleArchive = async (link) => {
    try {
      await updateTrainerClient(link.link_id, { status: 'archived' });
      load();
    } catch {
      Alert.alert('Could not archive client.');
    }
  };

  const handleUnarchive = async (link) => {
    try {
      await updateTrainerClient(link.link_id, { status: 'active' });
      load();
    } catch {
      Alert.alert('Could not unarchive client.');
    }
  };

  const handleDelete = (link) => {
    Alert.alert(
      'Remove client',
      `Permanently remove ${link.username} from your roster? Their workout history is preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrainerClient(link.link_id);
              load();
            } catch {
              Alert.alert('Could not remove client.');
            }
          },
        },
      ],
    );
  };

  const visibleList = showArchived ? archived : active;

  const renderRow = ({ item }) => (
    <GlassCard style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.meta}>
          {item.is_primary ? '★ primary · ' : ''}
          since {new Date(item.started_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.rowActions}>
        {item.status === 'active' ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Archive ${say(item.username)}`} onPress={() => handleArchive(item)} style={styles.btnGhost} hitSlop={PILL_HIT_SLOP}>
            <Text style={styles.btnText}>Archive</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Restore ${say(item.username)}`} onPress={() => handleUnarchive(item)} style={styles.btnGhost} hitSlop={PILL_HIT_SLOP}>
            <Text style={styles.btnText}>Restore</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${say(item.username)}`} onPress={() => handleDelete(item)} style={styles.btnDanger} hitSlop={PILL_HIT_SLOP}>
          <Text style={styles.btnDangerText}>✕</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );

  return (
    <ScreenWrapper scrollable={false}>
      <CustomHeader title="Manage Clients" />

      <View style={styles.addBox}>
        <TextInput
          accessibilityLabel="Client username"
          style={styles.input}
          placeholder="Client username"
          placeholderTextColor={Theme.colors.textSecondary}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={adding ? 'Adding client' : 'Add client'}
          accessibilityState={{ disabled: adding || !username.trim(), busy: adding }}
          onPress={handleAdd}
          disabled={adding || !username.trim()}
          style={[styles.btnPrimary, (!username.trim() || adding) && { opacity: 0.5 }]}
        >
          <Text style={styles.btnPrimaryText}>{adding ? 'Adding…' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity accessibilityRole="tab" accessibilityLabel={`Active clients, ${active.length}`} accessibilityState={{ selected: !showArchived }} onPress={() => setShowArchived(false)} style={[styles.tab, !showArchived && styles.tabActive]} hitSlop={PILL_HIT_SLOP}>
          <Text style={styles.tabText}>Active ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="tab" accessibilityLabel={`Archived clients, ${archived.length}`} accessibilityState={{ selected: showArchived }} onPress={() => setShowArchived(true)} style={[styles.tab, showArchived && styles.tabActive]} hitSlop={PILL_HIT_SLOP}>
          <Text style={styles.tabText}>Archived ({archived.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: Theme.spacing.l }} />
      ) : (
        <FlatList
          data={visibleList}
          keyExtractor={(item) => String(item.link_id)}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: Theme.spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: Theme.spacing.s }} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {showArchived
                ? 'No archived clients.'
                : 'No active clients yet — add one above by username.'}
            </Text>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
        />
      )}
    </ScreenWrapper>
  );
}

// G63 — the Archive/Restore/Remove pills and the tabs are drawn 32-35pt tall; the slop takes the
// touch area to 44pt without growing the rows.
// G63 review — vertical only (the pills sit 8-16pt apart in a row), and the rows that hold them
// carry the same padding so the slop stays inside the parent (Android drops touches outside it).
const PILL_HIT_SLOP = { top: 7, bottom: 7 };

const styles = StyleSheet.create({
  addBox: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.l,
    marginBottom: Theme.spacing.l,
    gap: Theme.spacing.m,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: Theme.borderRadius.m,
    paddingHorizontal: Theme.spacing.m,
    paddingVertical: Theme.spacing.s,
    color: Theme.colors.text,
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.l,
    paddingVertical: Theme.spacing.m,
    borderRadius: Theme.borderRadius.m,
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.l,
    paddingVertical: 7, // G63 review — holds the tabs' hitSlop
    marginBottom: Theme.spacing.m,
    gap: Theme.spacing.m,
  },
  tab: {
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
    borderRadius: Theme.borderRadius.round,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: primaryAlpha(0.12),
  },
  tabText: {
    color: Theme.colors.text,
    fontSize: 13,
  },
  row: {
    marginHorizontal: Theme.spacing.l,
    padding: Theme.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flex: 1,
    paddingRight: Theme.spacing.m,
  },
  username: {
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: Theme.colors.muted || '#888',
    fontSize: 12,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Theme.spacing.s,
    paddingVertical: 7, // G63 review — holds the pills' hitSlop
  },
  btnGhost: {
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
    borderRadius: Theme.borderRadius.round,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  btnText: {
    color: Theme.colors.text,
    fontSize: 12,
  },
  btnDanger: {
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
    borderRadius: Theme.borderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(255, 76, 76, 0.4)',
  },
  btnDangerText: {
    color: Theme.colors.error || '#ff4c4c',
    fontWeight: '700',
  },
  empty: {
    color: Theme.colors.muted || '#888',
    textAlign: 'center',
    marginTop: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.l,
  },
});
