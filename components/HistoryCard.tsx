import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HistoryEntry } from '../hooks/useReminders';

interface HistoryCardProps {
  entry: HistoryEntry;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function HistoryCard({ entry }: HistoryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.checkDot} />
      <View style={styles.content}>
        <Text style={styles.text}>{entry.text}</Text>
        <Text style={styles.date}>Done {formatDate(entry.completedAt)}</Text>
        <Text style={styles.createdDate}>Created {formatDate(entry.createdAt)}</Text>
      </View>
    </View>
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
    borderWidth: 1,
    borderColor: '#2a2a3e',
    opacity: 0.85,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
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
    color: '#c0c0d0',
    lineHeight: 22,
    letterSpacing: 0.1,
    textDecorationLine: 'line-through',
  },
  date: {
    fontSize: 11,
    color: '#22c55e',
    marginTop: 5,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  createdDate: {
    fontSize: 11,
    color: '#6b6b8a',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
