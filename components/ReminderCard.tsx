import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Reminder } from '../hooks/useReminders';

interface ReminderCardProps {
  reminder: Reminder;
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
}

export default function ReminderCard({ reminder, onDelete, onMarkDone }: ReminderCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleMarkDone = () => {
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
      onMarkDone(reminder.id);
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

  const formattedDate = new Date(reminder.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.pinDot} />
      <View style={styles.content}>
        <Text style={styles.text}>{reminder.text}</Text>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>
      <TouchableOpacity
        style={styles.doneBtn}
        onPress={handleMarkDone}
        activeOpacity={0.7}
        accessibilityLabel={`Mark as done: ${reminder.text}`}
      >
        <Text style={styles.doneBtnText}>✓</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDelete}
        activeOpacity={0.7}
        accessibilityLabel={`Delete reminder: ${reminder.text}`}
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
    borderColor: '#2a2a3e',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
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
  date: {
    fontSize: 11,
    color: '#6b6b8a',
    marginTop: 5,
    letterSpacing: 0.2,
  },
  doneBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1a2a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  doneBtnText: {
    color: '#22c55e',
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
});
