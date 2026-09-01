export interface HabitScheduleLike {
  createdAt: number;
  days: number[]; // 0 = Sunday ... 6 = Saturday, matching Date.getDay()
}

export interface HabitProgress {
  doneCount: number;
  missedCount: number;
  currentStreak: number;
  todayScheduled: boolean;
  doneToday: boolean;
}

/** Local (not UTC) YYYY-MM-DD key for a given date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

interface DayStatus {
  scheduled: boolean;
  done: boolean;
  isToday: boolean;
}

function buildDayStatuses(habit: HabitScheduleLike, doneSet: Set<string>): DayStatus[] {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cursor = new Date(habit.createdAt);
  cursor.setHours(0, 0, 0, 0);

  const statuses: DayStatus[] = [];
  while (cursor.getTime() <= todayMidnight.getTime()) {
    statuses.push({
      scheduled: habit.days.includes(cursor.getDay()),
      done: doneSet.has(dateKey(cursor)),
      isToday: cursor.getTime() === todayMidnight.getTime(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return statuses;
}

/**
 * Derives done/missed history and the current streak purely from the habit's
 * schedule and its log of completed dates — no background job or daily reset
 * needed, since "today" is always recomputed from the device clock.
 *
 * Today is never counted as missed, even if its time has already passed:
 * it stays "pending" until the day rolls over.
 */
export function getHabitProgress(habit: HabitScheduleLike, doneDates: string[]): HabitProgress {
  const doneSet = new Set(doneDates);
  const statuses = buildDayStatuses(habit, doneSet);

  let doneCount = 0;
  let missedCount = 0;
  for (const s of statuses) {
    if (!s.scheduled) continue;
    if (s.done) doneCount++;
    else if (!s.isToday) missedCount++;
  }

  // Walk backward from today, counting consecutive completed scheduled days.
  // A pending (not-yet-done) today doesn't break the streak; a missed day does.
  let currentStreak = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    const s = statuses[i];
    if (!s.scheduled) continue;
    if (s.done) {
      currentStreak++;
      continue;
    }
    if (s.isToday) continue;
    break;
  }

  const today = statuses[statuses.length - 1];
  return {
    doneCount,
    missedCount,
    currentStreak,
    todayScheduled: today?.scheduled ?? false,
    doneToday: today?.done ?? false,
  };
}
