import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Habit } from '../hooks/useHabits';
import { HabitProgress } from '../utils/habitStats';

interface HabitCardProps {
  habit: Habit;
  progress: HabitProgress;
  onToggleToday: (id: string) => void;
  onDelete: (id: string) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSchedule(habit: Habit): string {
  const time = `${habit.hour.toString().padStart(2, '0')}:${habit.minute.toString().padStart(2, '0')}`;
  const daysLabel =
    habit.days.length === 7 ? 'Every day' : habit.days.map((d) => DAY_LABELS[d]).join(', ');
  return `${daysLabel} • ${time}`;
}

export default function HabitCard({ habit, progress, onToggleToday, onDelete }: HabitCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleDelete = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onDelete(habit.id);
    });
  };

  const { doneCount, missedCount, currentStreak, todayScheduled, doneToday } = progress;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.topRow}>
        <View style={styles.pinDot} />
        <View style={styles.content}>
          <Text style={styles.text}>{habit.text}</Text>
          <Text style={styles.schedule}>🔁 {formatSchedule(habit)}</Text>
        </View>

        {todayScheduled ? (
          <TouchableOpacity
            style={[styles.tickBtn, doneToday && styles.tickBtnDone]}
            onPress={() => onToggleToday(habit.id)}
            activeOpacity={0.7}
            accessibilityLabel={
              doneToday ? `Mark not done today: ${habit.text}` : `Mark done today: ${habit.text}`
            }
          >
            <Text style={[styles.tickBtnText, doneToday && styles.tickBtnTextDone]}>✓</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.tickBtnMuted}>
            <Text style={styles.tickBtnMutedText}>–</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.7}
          accessibilityLabel={`Delete task: ${habit.text}`}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <Text style={styles.statBadgeText}>✅ {doneCount} done</Text>
        </View>
        <View style={[styles.statBadge, styles.statBadgeMissed]}>
          <Text style={[styles.statBadgeText, styles.statBadgeTextMissed]}>
            ❌ {missedCount} missed
          </Text>
        </View>
        {currentStreak > 0 && (
          <View style={[styles.statBadge, styles.statBadgeStreak]}>
            <Text style={[styles.statBadgeText, styles.statBadgeTextStreak]}>
              🔥 {currentStreak} streak
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 6,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8b5cf6',
    marginRight: 14,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f0f0f5',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  schedule: {
    fontSize: 12,
    color: '#8b8ba7',
    marginTop: 5,
    letterSpacing: 0.2,
  },
  tickBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1a2a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  tickBtnDone: {
    backgroundColor: '#22c55e',
  },
  tickBtnText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
  },
  tickBtnTextDone: {
    color: '#ffffff',
  },
  tickBtnMuted: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#20202e',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  tickBtnMutedText: {
    color: '#4b4b66',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  statBadge: {
    backgroundColor: '#182b1c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#224028',
  },
  statBadgeMissed: {
    backgroundColor: '#2a1a1a',
    borderColor: '#422424',
  },
  statBadgeStreak: {
    backgroundColor: '#2b2313',
    borderColor: '#544618',
  },
  statBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  statBadgeTextMissed: {
    color: '#ef4444',
  },
  statBadgeTextStreak: {
    color: '#eab308',
  },
});
