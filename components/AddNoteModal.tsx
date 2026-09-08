import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

interface AddNoteModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
  onDelete?: () => void;
  initialTitle?: string;
  initialDescription?: string;
}

export default function AddNoteModal({
  visible,
  onClose,
  onSave,
  onDelete,
  initialTitle = '',
  initialDescription = '',
}: AddNoteModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const titleRef = useRef<TextInput>(null);
  const isEditing = onDelete !== undefined;

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
    // Only reset when the modal opens, not on every keystroke re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isValid = title.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave(title.trim(), description.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? '🔒 Edit Note' : '🔒 New Note'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={styles.sectionLabel}>Title</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={titleRef}
                style={styles.input}
                placeholder="e.g. Wi-Fi Password"
                placeholderTextColor="#555577"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                autoCorrect
              />
            </View>

            <Text style={styles.sectionLabel}>Description</Text>
            <View style={[styles.inputContainer, styles.descriptionContainer]}>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Details..."
                placeholderTextColor="#555577"
                value={description}
                onChangeText={setDescription}
                maxLength={2000}
                multiline
                textAlignVertical="top"
                autoCorrect
              />
            </View>
          </ScrollView>

          <View style={styles.footerRow}>
            {isEditing ? (
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.confirmBtn, !isValid && styles.confirmBtnDisabled]}
              onPress={handleSave}
              disabled={!isValid}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>{isEditing ? 'Save' : 'Add Note'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#161626',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222238',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f0f0f5',
    letterSpacing: -0.3,
  },
  closeBtn: {
    fontSize: 18,
    color: '#8b8ba7',
    padding: 4,
  },
  scroll: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b8ba7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
  },
  inputContainer: {
    backgroundColor: '#1c1c30',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d48',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  descriptionContainer: {
    minHeight: 140,
  },
  input: {
    color: '#f0f0f5',
    fontSize: 15,
    lineHeight: 20,
    minHeight: 24,
  },
  descriptionInput: {
    minHeight: 120,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#222238',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30304c',
  },
  cancelBtnText: {
    color: '#9e9eb8',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#2a1a1a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a2424',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#eab308',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#3a3624',
  },
  confirmBtnText: {
    color: '#0d0d1a',
    fontSize: 15,
    fontWeight: '700',
  },
});
