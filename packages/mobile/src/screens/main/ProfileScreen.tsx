import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Circle as SvgCircle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import type { KycStatus } from '../../types';

// ── Mock User Data ────────────────────────────────────────────────────────────

const MOCK_USER = {
  displayName: 'Alex Thompson',
  email: 'alex@example.com',
  kycStatus: 'verified' as KycStatus,
  twoFactorEnabled: true,
  memberSince: 'March 2024',
};

// ── KYC Badge ─────────────────────────────────────────────────────────────────

function KycBadge({ status }: { status: KycStatus }) {
  const config = {
    none: { label: 'Not Started', color: colors.textTertiary, bg: colors.bgTertiary },
    pending: { label: 'Under Review', color: colors.warning, bg: colors.warningMuted },
    verified: { label: 'Verified', color: colors.success, bg: colors.successMuted },
    rejected: { label: 'Rejected', color: colors.danger, bg: colors.dangerMuted },
  }[status];

  return (
    <View style={[styles.kycBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.kycBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ── Settings Row ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  isDestructive,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | React.ReactNode;
  onPress?: () => void;
  isDestructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={!onPress}
    >
      <View style={styles.settingsRowLeft}>
        {icon}
        <Text style={[styles.settingsLabel, isDestructive && styles.settingsLabelDanger]}>
          {label}
        </Text>
      </View>
      <View style={styles.settingsRowRight}>
        {typeof value === 'string' ? (
          <Text style={styles.settingsValue}>{value}</Text>
        ) : (
          value
        )}
        {onPress && (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: spacing.sm }}>
            <Path
              d="M9 18l6-6-6-6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
        },
      },
    ]);
  }, [logout]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {MOCK_USER.displayName.split(' ').map((n) => n[0]).join('')}
            </Text>
          </View>
          <Text style={styles.userName}>{MOCK_USER.displayName}</Text>
          <Text style={styles.userEmail}>{MOCK_USER.email}</Text>
          <Text style={styles.memberSince}>Member since {MOCK_USER.memberSince}</Text>
        </View>

        {/* Identity & Verification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity & Verification</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="KYC Verification"
              value={<KycBadge status={MOCK_USER.kycStatus} />}
              onPress={() => {}}
            />
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM17 11l2 2 4-4" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Personal Information"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 1a4 4 0 014 4v2a4 4 0 01-8 0V5a4 4 0 014-4zM5 11a7 7 0 0114 0M3 15a11 11 0 0118 0" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
              }
              label="Biometric Login"
              value="Enabled"
              onPress={() => {}}
            />
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Two-Factor Authentication"
              value={MOCK_USER.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              onPress={() => {}}
            />
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M7 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Change Password"
              onPress={() => {}}
            />
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Device Management"
              value="3 devices"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Notifications"
              onPress={() => {}}
            />
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <SvgCircle cx="12" cy="12" r="10" stroke={colors.primary} strokeWidth={2} />
                  <Path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
              label="Currency"
              value="USD"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <SvgCircle cx="12" cy="12" r="10" stroke={colors.primary} strokeWidth={2} />
                  <Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Help Center"
              onPress={() => {}}
            />
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Terms of Service"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={colors.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
              label="Sign Out"
              isDestructive
              onPress={handleLogout}
            />
          </View>
        </View>

        {/* App Version */}
        <Text style={styles.version}>NovEx v1.0.0</Text>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  userCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    ...typography.h3,
    color: colors.text,
  },
  userEmail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  memberSince: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  settingsGroup: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsLabel: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.md,
  },
  settingsLabelDanger: {
    color: colors.danger,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsValue: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  kycBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  kycBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  bottomPad: {
    height: spacing.xxxl + 16,
  },
});
