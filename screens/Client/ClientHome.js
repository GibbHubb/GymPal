import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';
import CustomButton from '../../components/CustomButton';
import ScreenWrapper from '../../components/ScreenWrapper';
import VolumeHeatmap from '../../components/VolumeHeatmap';
import { getPendingCount } from '../../utils/syncQueue';
import { fetchTodayProgram, fetchTemplates, deleteTemplate } from '../../api';
import { useDeloadSignal } from '../../hooks/useDeloadSignal';  // G29


const ClientHome = ({ navigation }) => {
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  // G16 — today's-session resolver
  const [today, setToday] = useState(null);
  // G33 — the signed-in client's saved workout templates
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const refresh = async () => {
      const count = await getPendingCount();
      setPendingSyncCount(count);
      try {
        const t = await fetchTodayProgram();
        setToday(t);
      } catch { /* silent — banner just stays hidden */ }
      try {
        const tpl = await fetchTemplates();
        setTemplates(Array.isArray(tpl) ? tpl : []);
      } catch { /* silent — templates section just stays hidden */ }
    };
    refresh();
    const unsubscribe = navigation.addListener('focus', refresh);
    return unsubscribe;
  }, [navigation]);

  // G33 — start a workout from a saved template via the G32 prefill path.
  const startTemplate = (template) => {
    navigation.navigate('TrainingScreen', {
      prefill: { name: template.name, exercises: template.exercises || [] },
    });
  };

  // G33 — delete one of the client's own templates, then refresh the list.
  const handleDeleteTemplate = (template) => {
    Alert.alert(
      'Delete template',
      `Delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTemplate(template.id);
              setTemplates((prev) => prev.filter((t) => t.id !== template.id));
            } catch {
              Alert.alert('Error', 'Could not delete template.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert('Logged Out', 'You have been logged out.');
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  return (
    <ScreenWrapper scrollable={true}>
      {/* Logout Header */}
      <View style={styles.headerContainer}>
         <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
         </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* GymPal Logo */}
        <Text style={styles.title}>Welcome Back!</Text>

        {/* G16 — today's-session banner */}
        {today?.active && today?.template_name && (
          <TouchableOpacity
            style={styles.todayBanner}
            onPress={() => navigation.navigate('TrainingScreen')}
          >
            <Text style={styles.todayLabel}>📅 TODAY · {today.program_name} · W{today.week}/{today.total_weeks}</Text>
            <Text style={styles.todayTemplate}>{today.template_name}</Text>
            <Text style={styles.todayCta}>Start session →</Text>
          </TouchableOpacity>
        )}
        {today?.active && today?.rest_day && (
          <View style={[styles.todayBanner, styles.todayBannerRest]}>
            <Text style={styles.todayLabel}>📅 TODAY · {today.program_name} · W{today.week}/{today.total_weeks}</Text>
            <Text style={styles.todayTemplate}>Rest day — check back tomorrow</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <CustomButton
            title="📋 Intake"
            onPress={() => navigation.navigate('IntakeScreen')}
            style={styles.actionBtn}
          />
          <CustomButton
            title="🌿 Lifestyle"
            onPress={() => navigation.navigate('LifestyleScreen')}
            style={styles.actionBtn}
          />
          <View style={styles.trainingBtnWrapper}>
            <CustomButton
              title="💪 Training"
              onPress={() => navigation.navigate('TrainingScreen')}
              style={styles.actionBtn}
            />
            {pendingSyncCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingSyncCount}</Text>
              </View>
            )}
          </View>
          {/* G30 — repeat the most recent logged workout */}
          <CustomButton
            title="🔁 Repeat last"
            onPress={async () => {
              try {
                const token = await AsyncStorage.getItem('token');
                const res = await fetch(
                  'https://gympalbackend-production.up.railway.app/api/workouts/last',
                  { headers: { Authorization: `Bearer ${token}` } },
                );
                if (res.status === 404) {
                  Alert.alert('No previous workout', 'Log at least one workout first.');
                  return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const last = await res.json();
                navigation.navigate('TrainingScreen', { prefill: last });
              } catch (err) {
                Alert.alert('Could not load', String(err.message || err));
              }
            }}
            style={styles.actionBtn}
          />
          {/* G31 — opt-in weekly leaderboard */}
          <CustomButton
            title="🏆 Leaderboard"
            onPress={() => navigation.navigate('LeaderboardScreen')}
            style={styles.actionBtn}
          />
          <CustomButton
            title="📊 Progress"
            onPress={() => navigation.navigate('ProgressScreen')}
            style={styles.actionBtn}
          />
        </View>

        {/* G33 — saved workout templates */}
        <View style={styles.templatesSection}>
          <Text style={styles.templatesHeader}>📋 My Templates</Text>
          {templates.length === 0 ? (
            <Text style={styles.templatesEmpty}>
              No templates yet — save one from the Training screen.
            </Text>
          ) : (
            templates.map((t) => (
              <View key={t.id} style={styles.templateRow}>
                <TouchableOpacity
                  style={styles.templateStart}
                  onPress={() => startTemplate(t)}
                >
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateMeta}>
                    {(t.exercises?.length || 0)} exercise{(t.exercises?.length || 0) === 1 ? '' : 's'} · Start →
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.templateDelete}
                  onPress={() => handleDeleteTemplate(t)}
                >
                  <Text style={styles.templateDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* G29 — deload banner shown when 4 weeks of rising volume detected */}
        <DeloadBanner />

        {/* G15 — weekly volume heatmap, sits below the action buttons */}
        <VolumeHeatmap />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    padding: Theme.spacing.m,
    alignItems: 'flex-end',
    width: '100%',
  },
  logoutBtn: {
    paddingVertical: Theme.spacing.s,
    paddingHorizontal: Theme.spacing.m,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  logoutText: {
    color: Theme.colors.error,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.l,
  },
  logo: {
    width: 200,
    height: 100,
    resizeMode: 'contain',
    marginBottom: Theme.spacing.xl,
    tintColor: Theme.colors.primary, // Optional: if you want the logo to adapt to the gold theme
  },
  title: {
    ...Theme.typography.header,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: Theme.spacing.m, // Uses gap for modern layout spacing
  },
  actionBtn: {
    width: '100%',
  },
  trainingBtnWrapper: {
    position: 'relative',
    width: '100%',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // G16 — today's-session banner
  todayBanner: {
    width: '100%',
    maxWidth: 400,
    marginBottom: Theme.spacing.l,
    padding: Theme.spacing.m,
    borderRadius: Theme.borderRadius?.l || 12,
    backgroundColor: 'rgba(246, 176, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(246, 176, 0, 0.35)',
  },
  todayBannerRest: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  todayLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  todayTemplate: {
    color: Theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  todayCta: {
    color: Theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // G33 — saved templates section
  templatesSection: {
    width: '100%',
    maxWidth: 400,
    marginTop: Theme.spacing.l,
  },
  templatesHeader: {
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Theme.spacing.s,
  },
  templatesEmpty: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Theme.spacing.s,
    gap: Theme.spacing.s,
  },
  templateStart: {
    flex: 1,
    padding: Theme.spacing.m,
    borderRadius: Theme.borderRadius?.m || 8,
    backgroundColor: 'rgba(246, 176, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(246, 176, 0, 0.35)',
  },
  templateName: {
    color: Theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  templateMeta: {
    color: Theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  templateDelete: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.m,
    borderRadius: Theme.borderRadius?.m || 8,
    backgroundColor: 'rgba(229,57,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.35)',
  },
  templateDeleteText: {
    color: '#e53935',
    fontSize: 16,
    fontWeight: '700',
  },
});

// G29 — Small inline banner; null when no signal.
function DeloadBanner() {
  const { recommend, reason } = useDeloadSignal();
  if (!recommend) return null;
  return (
    <View
      style={{
        marginTop: 12, padding: 12,
        backgroundColor: '#fef3c7', borderRadius: 8,
        borderWidth: 1, borderColor: '#f59e0b',
      }}
    >
      <Text style={{ fontWeight: '600', color: '#92400e', marginBottom: 4 }}>
        🛌 Consider a deload week
      </Text>
      <Text style={{ color: '#78350f', fontSize: 12 }}>{reason}</Text>
    </View>
  );
}

export default ClientHome;
