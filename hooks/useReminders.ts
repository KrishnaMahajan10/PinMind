import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  syncRemindersToNotifications,
  syncScheduledRemindersToNative,
  startReminderHeartbeat,
  scheduleTimedAlert,
  cancelTimedAlert,
  getNativeForegroundReminders,
} from '../utils/notifications';

const STORAGE_KEY = '@reminders';
const SCHEDULED_STORAGE_KEY = '@reminders_scheduled';
const HISTORY_STORAGE_KEY = '@reminders_history';

export interface Reminder {
  id: string;
  text: string;
  createdAt: number;
}

export interface ScheduledReminder {
  id: string;
  text: string;
  createdAt: number;
  remindAt: number;
}

export interface HistoryEntry {
  id: string;
  text: string;
  createdAt: number;
  completedAt: number;
  remindAt?: number;
}

/**
 * Custom hook that manages active reminders, scheduled Remind Me alerts, and completion history.
 */
export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scheduledReminders, setScheduledReminders] = useState<ScheduledReminder[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Latest lists, so the periodic sweep below always reads current state without
  // having to tear down and re-arm its interval on every change.
  const latestRef = useRef({ active: reminders, scheduled: scheduledReminders });
  latestRef.current = { active: reminders, scheduled: scheduledReminders };

  // Promote past-due scheduled reminders to active pinned reminders
  const checkAndPromoteDueReminders = useCallback(
    async (
      activeList: Reminder[],
      scheduledList: ScheduledReminder[]
    ): Promise<{ updatedActive: Reminder[]; updatedScheduled: ScheduledReminder[] }> => {
      const now = Date.now();
      const due = scheduledList.filter((s) => s.remindAt <= now);
      if (due.length === 0) {
        return { updatedActive: activeList, updatedScheduled: scheduledList };
      }

      const newActiveItems: Reminder[] = due.map((item) => ({
        id: item.id,
        text: item.text,
        createdAt: item.createdAt,
      }));

      const updatedActive = [...newActiveItems, ...activeList];
      const updatedScheduled = scheduledList.filter((s) => s.remindAt > now);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedActive)),
        AsyncStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(updatedScheduled)),
      ]);

      await syncScheduledRemindersToNative(updatedScheduled);
      await syncRemindersToNotifications(updatedActive);

      return { updatedActive, updatedScheduled };
    },
    []
  );

  // Load reminders, scheduled reminders, and history on mount
  useEffect(() => {
    (async () => {
      try {
        const [rawReminders, rawScheduled, rawHistory] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SCHEDULED_STORAGE_KEY),
          AsyncStorage.getItem(HISTORY_STORAGE_KEY),
        ]);

        const storedReminders: Reminder[] = rawReminders ? JSON.parse(rawReminders) : [];
        const storedScheduled: ScheduledReminder[] = rawScheduled ? JSON.parse(rawScheduled) : [];
        const storedHistory: HistoryEntry[] = rawHistory ? JSON.parse(rawHistory) : [];

        // Check if any scheduled reminder became due while app was closed
        const { updatedActive, updatedScheduled } = await checkAndPromoteDueReminders(
          storedReminders,
          storedScheduled
        );

        // Pick up anything a native alarm already promoted into "To Do" while
        // the app process was dead, so the Active tab matches the notification.
        let finalActive = updatedActive;
        let finalScheduled = updatedScheduled;
        const nativeReminders = await getNativeForegroundReminders();
        if (nativeReminders.length > 0) {
          const activeIds = new Set(finalActive.map((r) => r.id));
          const doneIds = new Set(storedHistory.map((h) => h.id));
          // Anything the native side pinned that JS does not already show — whether
          // its exact alarm fired or the minute heartbeat swept it up — belongs in
          // the Active tab. Items already marked done are never resurrected.
          const toPromote = nativeReminders.filter(
            (n) => !activeIds.has(n.id) && !doneIds.has(n.id)
          );
          if (toPromote.length > 0) {
            const promotedIds = new Set(toPromote.map((n) => n.id));
            finalScheduled = finalScheduled.filter((s) => !promotedIds.has(s.id));
            finalActive = [
              ...toPromote.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt })),
              ...finalActive,
            ];
            await Promise.all([
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(finalActive)),
              AsyncStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(finalScheduled)),
            ]);
          }
        }

        setReminders(finalActive);
        setScheduledReminders(finalScheduled);
        setHistory(storedHistory);

        // Reschedule any future alerts to ensure exact timers are registered
        const now = Date.now();
        for (const item of finalScheduled) {
          if (item.remindAt > now) {
            await scheduleTimedAlert(item.id, item.text, item.remindAt);
          }
        }

        await syncScheduledRemindersToNative(finalScheduled);
        await syncRemindersToNotifications(finalActive);
        startReminderHeartbeat();
      } catch (e) {
        console.error('Failed to load reminders', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [checkAndPromoteDueReminders]);

  // Periodic check every 15 seconds to promote due reminders automatically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const due = latestRef.current.scheduled.filter((s) => s.remindAt <= now);
      if (due.length === 0) return;

      const { active: currentActive, scheduled: currentScheduled } = latestRef.current;
      const activeIds = new Set(currentActive.map((r) => r.id));
      const promoted: Reminder[] = due
        .filter((d) => !activeIds.has(d.id))
        .map((d) => ({ id: d.id, text: d.text, createdAt: d.createdAt }));

      const updatedActive = [...promoted, ...currentActive];
      const updatedScheduled = currentScheduled.filter((s) => s.remindAt > now);

      setReminders(updatedActive);
      setScheduledReminders(updatedScheduled);

      (async () => {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedActive));
        await AsyncStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(updatedScheduled));
        await syncScheduledRemindersToNative(updatedScheduled);
        await syncRemindersToNotifications(updatedActive);
      })();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Persist active reminders array to AsyncStorage & sync to notification bar
  const persistActive = useCallback(async (updated: Reminder[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    await syncRemindersToNotifications(updated);
  }, []);

  // Persist scheduled reminders to AsyncStorage & mirror them to the native store
  const persistScheduled = useCallback(async (updated: ScheduledReminder[]) => {
    await AsyncStorage.setItem(SCHEDULED_STORAGE_KEY, JSON.stringify(updated));
    await syncScheduledRemindersToNative(updated);
  }, []);

  // Add a normal active pinned reminder
  const addReminder = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const newReminder: Reminder = {
        id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        createdAt: Date.now(),
      };

      const updated = [newReminder, ...reminders];
      setReminders(updated);
      await persistActive(updated);
    },
    [reminders, persistActive]
  );

  // Add a scheduled "Remind Me" alert reminder
  const addScheduledReminder = useCallback(
    async (text: string, remindAt: number) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const newScheduled: ScheduledReminder = {
        id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        createdAt: Date.now(),
        remindAt,
      };

      const updated = [newScheduled, ...scheduledReminders].sort(
        (a, b) => a.remindAt - b.remindAt
      );

      setScheduledReminders(updated);
      await persistScheduled(updated);
      await scheduleTimedAlert(newScheduled.id, newScheduled.text, newScheduled.remindAt);
    },
    [scheduledReminders, persistScheduled]
  );

  // Delete an active reminder
  const deleteReminder = useCallback(
    async (id: string) => {
      const updated = reminders.filter((r) => r.id !== id);
      setReminders(updated);
      await persistActive(updated);
    },
    [reminders, persistActive]
  );

  // Delete a scheduled reminder and cancel its alert
  const deleteScheduledReminder = useCallback(
    async (id: string) => {
      await cancelTimedAlert(id);
      const updated = scheduledReminders.filter((s) => s.id !== id);
      setScheduledReminders(updated);
      await persistScheduled(updated);
    },
    [scheduledReminders, persistScheduled]
  );

  // Promote a scheduled reminder immediately to active pinned list
  const promoteScheduledToActive = useCallback(
    async (id: string) => {
      const target = scheduledReminders.find((s) => s.id === id);
      if (!target) return;

      await cancelTimedAlert(id);
      const updatedScheduled = scheduledReminders.filter((s) => s.id !== id);
      const newActiveItem: Reminder = {
        id: target.id,
        text: target.text,
        createdAt: target.createdAt,
      };
      const updatedActive = [newActiveItem, ...reminders];

      setScheduledReminders(updatedScheduled);
      setReminders(updatedActive);

      await Promise.all([
        persistScheduled(updatedScheduled),
        persistActive(updatedActive),
      ]);
    },
    [scheduledReminders, reminders, persistScheduled, persistActive]
  );

  // Mark an active reminder as done — moves it to history
  const markAsDone = useCallback(
    async (id: string) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return;

      const entry: HistoryEntry = {
        ...reminder,
        completedAt: Date.now(),
      };

      const updatedReminders = reminders.filter((r) => r.id !== id);
      const updatedHistory = [entry, ...history];

      setReminders(updatedReminders);
      setHistory(updatedHistory);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedReminders));
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      await syncRemindersToNotifications(updatedReminders);
    },
    [reminders, history]
  );

  return {
    reminders,
    scheduledReminders,
    history,
    loading,
    addReminder,
    addScheduledReminder,
    deleteReminder,
    deleteScheduledReminder,
    promoteScheduledToActive,
    markAsDone,
  };
}
