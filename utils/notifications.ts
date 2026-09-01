import * as Notifications from 'expo-notifications';
import { Platform, NativeModules, Linking, Alert } from 'react-native';

const { ReminderModule } = NativeModules;
export const CHANNEL_ID_PERSISTENT = 'persistent-reminders';
export const CHANNEL_ID_ALERTS = 'timed-alerts';
export const CHANNEL_ID_TASKS = 'daily-tasks';

const HABIT_IDENTIFIER_PREFIX = 'habit_';

// Identifier for the single aggregated "To Do" pin used by the Expo Go fallback.
const PERSISTENT_SUMMARY_ID = 'pinmind_todo_summary';

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

    // 3. Recurring Daily Task Channel
    await Notifications.setNotificationChannelAsync(CHANNEL_ID_TASKS, {
      name: 'Tasks',
      description: 'Recurring daily/weekly task reminders at the time you choose.',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250, 150, 250],
      enableLights: true,
      lightColor: '#8b5cf6',
      showBadge: true,
    });
  } catch (error) {
    console.error('Error creating notification channels:', error);
  }
}

/**
 * All possible notification identifiers a habit could occupy: one for the
 * "every day" case, plus one per weekday (Expo weekday: 1 = Sunday ... 7 =
 * Saturday) for the "selected days" case. Cancelling is safe to call even for
 * identifiers that were never scheduled.
 */
function habitIdentifiers(habitId: string): string[] {
  return [
    `${HABIT_IDENTIFIER_PREFIX}${habitId}_daily`,
    ...[1, 2, 3, 4, 5, 6, 7].map((weekday) => `${HABIT_IDENTIFIER_PREFIX}${habitId}_${weekday}`),
  ];
}

/**
 * Cancel every recurring notification belonging to a habit.
 */
export async function cancelHabitNotifications(habitId: string) {
  for (const identifier of habitIdentifiers(habitId)) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {}
  }
}

/**
 * Schedule (or reschedule) the recurring "Tasks" alert for a habit, using
 * expo-notifications' native DAILY/WEEKLY triggers. These are backed by
 * AlarmManager and expo-notifications registers its own boot receiver, so the
 * schedule survives reboots without any custom native code.
 */
export async function scheduleHabitNotifications(habit: {
  id: string;
  text: string;
  hour: number;
  minute: number;
  days: number[];
}) {
  await createNotificationChannels();
  await cancelHabitNotifications(habit.id);

  if (habit.days.length === 0) return;

  const content: Notifications.NotificationContentInput = {
    title: 'Tasks',
    body: habit.text,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    color: '#8b5cf6',
    data: {
      type: 'habit',
      habitId: habit.id,
    },
  };

  if (Platform.OS === 'android') {
    (content as any).channelId = CHANNEL_ID_TASKS;
  }

  if (habit.days.length === 7) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${HABIT_IDENTIFIER_PREFIX}${habit.id}_daily`,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: habit.hour,
        minute: habit.minute,
        channelId: CHANNEL_ID_TASKS,
      },
    });
    return;
  }

  for (const day of habit.days) {
    // JS Date#getDay(): 0 = Sunday ... 6 = Saturday. Expo weekday: 1 = Sunday ... 7 = Saturday.
    const weekday = day + 1;
    await Notifications.scheduleNotificationAsync({
      identifier: `${HABIT_IDENTIFIER_PREFIX}${habit.id}_${weekday}`,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: habit.hour,
        minute: habit.minute,
        channelId: CHANNEL_ID_TASKS,
      },
    });
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
 * Mirror the pending "Remind Me" list into the native store.
 *
 * The native minute refresh sweeps this list on every tick, so a reminder still
 * lands in the pinned "To Do" list even if its own exact alarm was dropped by the
 * OS or came due while the JS process was dead.
 */
export async function syncScheduledRemindersToNative(
  scheduled: Array<{ id: string; text: string; createdAt: number; remindAt: number }>
) {
  if (Platform.OS !== 'android' || !ReminderModule?.setScheduledReminders) return;
  try {
    ReminderModule.setScheduledReminders(JSON.stringify(scheduled));
  } catch (e) {
    console.warn('Failed to mirror scheduled reminders to native:', e);
  }
}

/**
 * Make sure the native one-minute refresh chain is armed. Safe to call repeatedly.
 */
export function startReminderHeartbeat() {
  if (Platform.OS !== 'android' || !ReminderModule?.startHeartbeat) return;
  try {
    ReminderModule.startHeartbeat();
  } catch (e) {
    console.warn('Failed to start reminder heartbeat:', e);
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

  // Drop the previous pin and its repeat so the next one carries the full,
  // current list rather than a stale slice of it.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (!notif.identifier.startsWith('alert_')) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  if (reminders.length === 0) {
    await Notifications.dismissAllNotificationsAsync();
    return;
  }

  // One aggregated pin listing every active reminder, mirroring what the native
  // foreground service shows on a built APK.
  const title = reminders.length === 1 ? 'To Do' : `To Do (${reminders.length})`;
  const body = reminders.map((r) => `• ${r.text}`).join('\n');

  const content: Notifications.NotificationContentInput = {
    title,
    body,
    sticky: true,
    autoDismiss: false,
    priority: Notifications.AndroidNotificationPriority.LOW,
    sound: false,
    color: '#f97316',
    data: { type: 'persistent', count: reminders.length },
  };

  if (Platform.OS === 'android') {
    (content as any).channelId = CHANNEL_ID_PERSISTENT;
  }

  // Show immediately …
  await Notifications.scheduleNotificationAsync({
    identifier: PERSISTENT_SUMMARY_ID,
    content,
    trigger: null,
  });

  // … then silently re-post it every 60 seconds so it stays pinned.
  await Notifications.scheduleNotificationAsync({
    identifier: `${PERSISTENT_SUMMARY_ID}_repeat`,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: true,
      channelId: CHANNEL_ID_PERSISTENT,
    },
  });
}
