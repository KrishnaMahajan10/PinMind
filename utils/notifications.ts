import * as Notifications from 'expo-notifications';
import { Platform, NativeModules, Linking, Alert } from 'react-native';

const { ReminderModule } = NativeModules;
export const CHANNEL_ID_PERSISTENT = 'persistent-reminders';
export const CHANNEL_ID_ALERTS = 'timed-alerts';

/**
 * Configure notification presentation behavior when the app is in the foreground.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const isAlert = data?.type === 'timed-alert';

      return {
        shouldShowAlert: true,
        shouldPlaySound: isAlert, // Only play sound if it's an audible Remind Me alert
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

/**
 * Create both Android notification channels:
 * 1. To Do: LOW importance, completely silent (no sound, no vibration)
 * 2. Reminding You Alerts: MAX importance, audible sound, distinct vibration pattern
 */
export async function createNotificationChannels() {
  if (Platform.OS !== 'android') return;
  try {
    // 1. Silent Persistent Channel
    await Notifications.setNotificationChannelAsync(CHANNEL_ID_PERSISTENT, {
      name: 'To Do',
      description: 'Always-visible silent tasks pinned in the notification bar.',
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      sound: null,
      enableVibrate: false,
      vibrationPattern: null,
      enableLights: false,
      showBadge: false,
    });

    // 2. Audible Timed Alert Channel
    await Notifications.setNotificationChannelAsync(CHANNEL_ID_ALERTS, {
      name: 'Reminding You',
      description: 'Loud sound and vibration alert when a scheduled reminder is due.',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 300, 200, 300],
      enableLights: true,
      lightColor: '#f97316',
      showBadge: true,
    });
  } catch (error) {
    console.error('Error creating notification channels:', error);
  }
}

/**
 * Schedule a high-priority audible alert for a specific date and time.
 * Notification Title: "Reminding You"
 */
export async function scheduleTimedAlert(id: string, text: string, remindAt: number) {
  await createNotificationChannels();

  const alertIdentifier = `alert_${id}`;
  // Cancel any existing schedule for this id first
  try {
    await Notifications.cancelScheduledNotificationAsync(alertIdentifier);
  } catch {}

  const secondsUntilTrigger = Math.max(1, Math.floor((remindAt - Date.now()) / 1000));

  const content: Notifications.NotificationContentInput = {
    title: 'Reminding You',
    body: text,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    color: '#f97316',
    data: {
      reminderId: id,
      type: 'timed-alert',
      text,
      remindAt,
    },
  };

  if (Platform.OS === 'android') {
    (content as any).channelId = CHANNEL_ID_ALERTS;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: alertIdentifier,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
      repeats: false,
      channelId: CHANNEL_ID_ALERTS,
    },
  });

  // Also arm a native OS alarm that merges this reminder into the "To Do" list
  // the instant it fires, even if the app process has been killed.
  if (Platform.OS === 'android' && ReminderModule?.scheduleNativeAlert) {
    try {
      ReminderModule.scheduleNativeAlert(id, text, remindAt);
    } catch (e) {
      console.warn('Failed to schedule native alert sync:', e);
    }
  }
}

/**
 * Cancel a scheduled timed alert.
 */
export async function cancelTimedAlert(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`alert_${id}`);
  } catch (e) {
    console.warn('Failed to cancel scheduled notification:', e);
  }

  if (Platform.OS === 'android' && ReminderModule?.cancelNativeAlert) {
    try {
      ReminderModule.cancelNativeAlert(id);
    } catch (e) {
      console.warn('Failed to cancel native alert sync:', e);
    }
  }
}

/**
 * Read the reminders currently held in the native persistent "To Do" list —
 * including any promoted directly by a native alarm while the app was killed.
 */
export async function getNativeForegroundReminders(): Promise<
  Array<{ id: string; text: string; createdAt: number }>
> {
  if (Platform.OS !== 'android' || !ReminderModule?.getForegroundReminders) return [];
  try {
    const json = await ReminderModule.getForegroundReminders();
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to read native foreground reminders:', e);
    return [];
  }
}

/**
 * Request notification permissions from the user.
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * On Android, prompt the user to exempt PinMind from battery optimization.
 */
export function requestBatteryOptimizationExemption() {
  if (Platform.OS !== 'android') return;
  Alert.alert(
    '🔋 Keep Reminders Alive',
    'To ensure your pinned reminders and alerts stay active even when the phone is idle, please disable battery optimization for PinMind.\n\nTap "Open Settings", find PinMind, and select "Don\'t optimize" or "Unrestricted".',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings();
        },
      },
    ]
  );
}

/**
 * Synchronize the current active reminder list to persistent silent notifications.
 * Notification Title: "To Do"
 */
export async function syncRemindersToNotifications(
  reminders: Array<{ id: string; text: string }>
) {
  // ── Layer 1: Native foreground service (built APK only) ──────────────────
  if (Platform.OS === 'android' && ReminderModule) {
    try {
      if (reminders.length > 0) {
        ReminderModule.updateForegroundReminders(JSON.stringify(reminders));
      } else {
        ReminderModule.stopForegroundService();
      }
      return;
    } catch (e) {
      console.warn('Native ReminderModule failed, falling back to expo-notifications', e);
    }
  }

  // ── Layer 2: Expo-notifications fallback ─────────────────────────────────
  await createNotificationChannels();

  // Dismiss currently visible silent notifications
  await Notifications.dismissAllNotificationsAsync();

  if (reminders.length === 0) {
    // Cancel repeating persistent notifications (leave timed alert triggers intact)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (!notif.identifier.startsWith('alert_')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
    return;
  }

  const activeIds = new Set(reminders.map((r) => r.id));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (!notif.identifier.startsWith('alert_') && !activeIds.has(notif.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  for (const item of reminders) {
    const content: Notifications.NotificationContentInput = {
      title: 'To Do',
      body: item.text,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      sound: false,
      color: '#f97316',
      data: { reminderId: item.id, type: 'persistent' },
    };

    if (Platform.OS === 'android') {
      (content as any).channelId = CHANNEL_ID_PERSISTENT;
    }

    // Show immediately
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content,
      trigger: null,
    });

    // Schedule repeating every 60 seconds silently
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
        repeats: true,
        channelId: CHANNEL_ID_PERSISTENT,
      },
    });
  }
}
