import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { CustomList } from '../hooks/useLists';

interface ListCardProps {
  list: CustomList;
  itemCount: number;
  doneCount: number;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ListCard({ list, itemCount, doneCount, onPress, onDelete }: ListCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleDelete = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onDelete(list.id);
    });
  };

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.touchArea}
        onPress={() => onPress(list.id)}
        activeOpacity={0.75}
        accessibilityLabel={`Open list: ${list.name}`}
      >
        <View style={styles.pinDot} />
        <View style={styles.content}>
          <Text style={styles.text}>{list.name}</Text>
          <Text style={styles.summary}>
            {itemCount === 0 ? 'No items yet' : `${doneCount}/${itemCount} checked off`}
            {list.linked ? ' • 📌 Linked to notification' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDelete}
        activeOpacity={0.7}
        accessibilityLabel={`Delete list: ${list.name}`}
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
  touchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14b8a6',
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
  summary: {
    fontSize: 12,
    color: '#8b8ba7',
    marginTop: 5,
    letterSpacing: 0.2,
  },
  chevron: {
    fontSize: 22,
    color: '#4b4b66',
    marginLeft: 8,
    fontWeight: '300',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
