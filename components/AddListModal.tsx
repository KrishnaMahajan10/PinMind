import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

interface AddListModalProps {
  visible: boolean;
  onClose: () => void;
  onAddList: (name: string) => void;
}

export default function AddListModal({ visible, onClose, onAddList }: AddListModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const isValid = name.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    onAddList(name.trim());
    setName('');
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
            <Text style={styles.title}>📋 New List</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>List Name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="e.g. Shopping List, Travel Checklist"
              placeholderTextColor="#555577"
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleSave}
              returnKeyType="done"
              maxLength={60}
              autoCorrect
            />
          </View>
          <Text style={styles.hint}>
            You can link this list to your "To Do" pinned notification later, so its
            unchecked items show up there too.
          </Text>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !isValid && styles.confirmBtnDisabled]}
              onPress={handleSave}
              disabled={!isValid}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Create List</Text>
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b8ba7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
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
  input: {
    color: '#f0f0f5',
    fontSize: 15,
    lineHeight: 20,
    minHeight: 24,
  },
  hint: {
    fontSize: 12,
    color: '#6b6b8a',
    lineHeight: 17,
    marginTop: 10,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  confirmBtn: {
    flex: 2,
    backgroundColor: '#14b8a6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#2a3d3a',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
