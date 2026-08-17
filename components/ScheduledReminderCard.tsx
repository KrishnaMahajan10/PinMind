import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { ScheduledReminder } from '../hooks/useReminders';

interface ScheduledReminderCardProps {
  reminder: ScheduledReminder;
  onDelete: (id: string) => void;
  onPinNow: (id: string) => void;
}

export default function ScheduledReminderCard({
  reminder,
  onDelete,
  onPinNow,
}: ScheduledReminderCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePinNow = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPinNow(reminder.id);
    });
  };

  const handleDelete = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDelete(reminder.id);
    });
  };

  const formatScheduledTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const time24h = `${h}:${m}`;

    if (isToday) return `Today at ${time24h}`;
    if (isTomorrow) return `Tomorrow at ${time24h}`;
    const dateStr = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    return `${dateStr}, ${time24h}`;
  };

  const getRemainingTimeBadge = (timestamp: number) => {
    const diffMs = timestamp - Date.now();
    if (diffMs <= 0) return 'Due now';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `In ${diffMins} min${diffMins > 1 ? 's' : ''}`;

    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffHours < 24) {
      return remMins > 0 ? `In ${diffHours}h ${remMins}m` : `In ${diffHours}h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.clockDot} />
      <View style={styles.content}>
        <Text style={styles.text}>{reminder.text}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.scheduledText}>⏰ {formatScheduledTime(reminder.remindAt)}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getRemainingTimeBadge(reminder.remindAt)}</Text>
          </View>
        </View>
      </View>

      {/* Pin Now (Promote early) */}
      <TouchableOpacity
        style={styles.pinBtn}
        onPress={handlePinNow}
        activeOpacity={0.7}
        accessibilityLabel={`Pin now: ${reminder.text}`}
      >
        <Text style={styles.pinBtnText}>📌</Text>
      </TouchableOpacity>

      {/* Cancel/Delete */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDelete}
        activeOpacity={0.7}
        accessibilityLabel={`Cancel reminder: ${reminder.text}`}
      >
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderColor: '#342a42',
  },
  clockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eab308',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  scheduledText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badge: {
    backgroundColor: '#2b2618',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#544618',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#eab308',
  },
  pinBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#26203a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#3c3258',
  },
  pinBtnText: {
    fontSize: 14,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#422424',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
