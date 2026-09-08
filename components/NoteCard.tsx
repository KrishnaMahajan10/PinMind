import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SecretNote } from '../hooks/useSecretNotes';

interface NoteCardProps {
  note: SecretNote;
  onPress: (note: SecretNote) => void;
}

export default function NoteCard({ note, onPress }: NoteCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(note)}
      activeOpacity={0.75}
      accessibilityLabel={`Open note: ${note.title}`}
    >
      <View style={styles.pinDot} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title}
        </Text>
        {!!note.description && (
          <Text style={styles.description} numberOfLines={2}>
            {note.description}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
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
    backgroundColor: '#eab308',
    marginRight: 14,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f0f0f5',
    letterSpacing: 0.1,
  },
  description: {
    fontSize: 13,
    color: '#8b8ba7',
    marginTop: 4,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 22,
    color: '#4b4b66',
    marginLeft: 8,
    fontWeight: '300',
  },
});
