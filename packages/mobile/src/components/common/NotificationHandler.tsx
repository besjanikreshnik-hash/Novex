import React, { useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import type { Notification } from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import {
  setupForegroundNotificationListener,
  setupNotificationResponseListener,
} from '../../lib/push';
import { colors, spacing, borderRadius, typography } from '../../theme';

const TOAST_DURATION = 4000;
const TOAST_SLIDE_DURATION = 300;

/**
 * NotificationHandler
 *
 * - Listens for incoming push notifications while the app is foregrounded.
 * - Shows an in-app toast/banner for foreground notifications.
 * - Handles navigation when the user taps a notification (foreground or background).
 */
export function NotificationHandler() {
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastData, setToastData] = React.useState<{
    title: string;
    body: string;
  } | null>(null);

  // ── Show toast banner ────────────────────────────────────
  const showToast = useCallback(
    (title: string, body: string) => {
      // Clear any existing timeout
      if (toastTimeout.current) clearTimeout(toastTimeout.current);

      setToastData({ title, body });

      // Slide in
      Animated.timing(slideAnim, {
        toValue: Platform.OS === 'ios' ? 50 : 10,
        duration: TOAST_SLIDE_DURATION,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss
      toastTimeout.current = setTimeout(() => {
        dismissToast();
      }, TOAST_DURATION);
    },
    [slideAnim],
  );

  const dismissToast = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: TOAST_SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => setToastData(null));
  }, [slideAnim]);

  // ── Navigation handler ───────────────────────────────────
  const handleNavigate = useCallback(
    (screen: string, params?: Record<string, unknown>) => {
      try {
        navigation.navigate(screen, params);
      } catch {
        // Screen may not exist in the current navigator — ignore
      }
    },
    [navigation],
  );

  // ── Set up listeners ─────────────────────────────────────
  useEffect(() => {
    // Foreground notifications → show in-app toast
    const removeForeground = setupForegroundNotificationListener(
      (notification: Notification) => {
        const { title, body } = notification.request.content;
        if (title || body) {
          showToast(title ?? '', body ?? '');
        }
      },
    );

    // Notification tap → navigate
    const removeResponse = setupNotificationResponseListener(handleNavigate);

    return () => {
      removeForeground();
      removeResponse();
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, [showToast, handleNavigate]);

  // ── Render ───────────────────────────────────────────────
  if (!toastData) return null;

  return (
    <Animated.View
      style={[styles.toastContainer, { transform: [{ translateY: slideAnim }] }]}
    >
      <TouchableOpacity
        style={styles.toast}
        onPress={dismissToast}
        activeOpacity={0.8}
      >
        <View style={styles.toastIndicator} />
        <View style={styles.toastContent}>
          {toastData.title ? (
            <Text style={styles.toastTitle} numberOfLines={1}>
              {toastData.title}
            </Text>
          ) : null}
          {toastData.body ? (
            <Text style={styles.toastBody} numberOfLines={2}>
              {toastData.body}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  toastBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
