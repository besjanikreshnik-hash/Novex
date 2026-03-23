import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// ── Configure how notifications appear when the app is in the foreground ──

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Push Token Registration ──────────────────────────────────────────────────

/**
 * Request push notification permissions, obtain the Expo push token,
 * and register it with the backend.
 *
 * Returns the token string, or null if permissions were denied / unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('[Push] Must use a physical device for push notifications');
    return null;
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Push notification permission not granted');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C5CE7',
    });
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Determine platform
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceName = Device.modelName ?? `${Platform.OS} device`;

  // Register with backend
  try {
    await api.post('/push/register', { token, platform, deviceName });
    console.log('[Push] Token registered with backend');
  } catch (err) {
    console.warn('[Push] Failed to register token with backend:', err);
  }

  return token;
}

/**
 * Unregister the current device's push token from the backend.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.delete('/push/register', {
      body: { token: tokenData.data },
    } as any);
    console.log('[Push] Token unregistered from backend');
  } catch (err) {
    console.warn('[Push] Failed to unregister token:', err);
  }
}

// ── Notification Response Handling ───────────────────────────────────────────

export type NotificationNavCallback = (screen: string, params?: Record<string, unknown>) => void;

/**
 * Set up a listener for when the user taps on a notification.
 * Returns a cleanup function to remove the listener.
 */
export function setupNotificationResponseListener(
  onNavigate: NotificationNavCallback,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;

      if (data?.screen) {
        onNavigate(String(data.screen), data.params as Record<string, unknown> | undefined);
      }
    },
  );

  return () => subscription.remove();
}

/**
 * Set up a listener for notifications received while the app is in the foreground.
 * Returns a cleanup function to remove the listener.
 */
export function setupForegroundNotificationListener(
  onNotification: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(onNotification);
  return () => subscription.remove();
}
