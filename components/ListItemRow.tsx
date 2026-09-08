import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { ListItem } from '../hooks/useLists';

interface ListItemRowProps {
  item: ListItem;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ListItemRow({ item, onToggleDone, onDelete }: ListItemRowProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleDelete = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onDelete(item.id);
    });
  };

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.checkbox, item.done && styles.checkboxDone]}
        onPress={() => onToggleDone(item.id)}
        activeOpacity={0.7}
        accessibilityLabel={item.done ? `Mark not done: ${item.text}` : `Mark done: ${item.text}`}
      >
        {item.done && <Text style={styles.checkboxTick}>✓</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.content}
        onPress={() => onToggleDone(item.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.text, item.done && styles.textDone]}>{item.text}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDelete}
        activeOpacity={0.7}
        accessibilityLabel={`Delete item: ${item.text}`}
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
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3a3a54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxDone: {
    backgroundColor: '#14b8a6',
    borderColor: '#14b8a6',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f0f0f5',
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  textDone: {
    color: '#5c5c78',
    textDecorationLine: 'line-through',
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
