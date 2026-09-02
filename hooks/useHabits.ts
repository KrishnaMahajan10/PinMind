import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncHabitsToNative, syncHabitsDoneTodayToNative } from '../utils/notifications';
import { todayKey } from '../utils/habitStats';

const HABITS_STORAGE_KEY = '@habits';
const HABIT_COMPLETIONS_STORAGE_KEY = '@habit_completions';

export interface Habit {
  id: string;
  text: string;
  createdAt: number;
  hour: number;
  minute: number;
  days: number[]; // 0 = Sunday ... 6 = Saturday, matching Date.getDay()
}

/** habitId -> sorted list of "YYYY-MM-DD" dates marked done */
export type HabitCompletions = Record<string, string[]>;

/** Ids of every habit whose completion log already includes today. */
function doneIdsForToday(completions: HabitCompletions): string[] {
  const key = todayKey();
  return Object.keys(completions).filter((habitId) => completions[habitId]?.includes(key));
}

/**
 * Custom hook that manages recurring daily/weekly "Tasks" (habits) and their
 * per-day completion log. The habit list and today's done ids are mirrored to
 * a native store (see ReminderModule.setHabits/setHabitsDoneToday) so the
 * same minute heartbeat that reliably pins "To Do" also pins a "Tasks"
 * notification once a habit comes due — no separate alarm to be silently
 * killed by OEM battery managers, and nothing to reset at midnight since
 * "today" is always derived from the device clock (see utils/habitStats.ts).
 */
export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rawHabits, rawCompletions] = await Promise.all([
          AsyncStorage.getItem(HABITS_STORAGE_KEY),
          AsyncStorage.getItem(HABIT_COMPLETIONS_STORAGE_KEY),
        ]);
        const loadedHabits: Habit[] = rawHabits ? JSON.parse(rawHabits) : [];
        const loadedCompletions: HabitCompletions = rawCompletions ? JSON.parse(rawCompletions) : {};
        setHabits(loadedHabits);
        setCompletions(loadedCompletions);

        // Re-mirror to native on every load in case the native store ever
        // drifted (e.g. it was cleared without JS knowing).
        await syncHabitsToNative(loadedHabits);
        await syncHabitsDoneTodayToNative(doneIdsForToday(loadedCompletions));
      } catch (e) {
        console.error('Failed to load habits', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistHabits = useCallback(async (updated: Habit[]) => {
    await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const persistCompletions = useCallback(async (updated: HabitCompletions) => {
    await AsyncStorage.setItem(HABIT_COMPLETIONS_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  // Add a new recurring task and mirror it to the native store.
  const addHabit = useCallback(
    async (text: string, hour: number, minute: number, days: number[]) => {
      const trimmed = text.trim();
      if (!trimmed || days.length === 0) return;

      const newHabit: Habit = {
        id: `habit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        createdAt: Date.now(),
        hour,
        minute,
        days: [...days].sort((a, b) => a - b),
      };

      const updated = [newHabit, ...habits];
      setHabits(updated);
      await persistHabits(updated);
      await syncHabitsToNative(updated);
    },
    [habits, persistHabits]
  );

  // Delete a habit and its completion history, and mirror the change natively.
  const deleteHabit = useCallback(
    async (id: string) => {
      const updated = habits.filter((h) => h.id !== id);
      setHabits(updated);
      await persistHabits(updated);
      await syncHabitsToNative(updated);

      if (id in completions) {
        const updatedCompletions = { ...completions };
        delete updatedCompletions[id];
        setCompletions(updatedCompletions);
        await persistCompletions(updatedCompletions);
        await syncHabitsDoneTodayToNative(doneIdsForToday(updatedCompletions));
      }
    },
    [habits, completions, persistHabits, persistCompletions]
  );

  // Toggle today's completion tick for a habit (tapping again un-ticks it).
  const toggleHabitToday = useCallback(
    async (id: string) => {
      const key = todayKey();
      const existing = completions[id] ?? [];
      const isDone = existing.includes(key);
      const updatedForHabit = isDone ? existing.filter((d) => d !== key) : [...existing, key];
      const updated = { ...completions, [id]: updatedForHabit };

      setCompletions(updated);
      await persistCompletions(updated);
      await syncHabitsDoneTodayToNative(doneIdsForToday(updated));
    },
    [completions, persistCompletions]
  );

  return {
    habits,
    completions,
    loading,
    addHabit,
    deleteHabit,
    toggleHabitToday,
  };
}
