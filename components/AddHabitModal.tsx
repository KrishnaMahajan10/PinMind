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

interface AddHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onAddHabit: (text: string, hour: number, minute: number, days: number[]) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function AddHabitModal({ visible, onClose, onAddHabit }: AddHabitModalProps) {
  const [text, setText] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>(ALL_DAYS);
  const [selectedHour, setSelectedHour] = useState<number>(7);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  const inputRef = useRef<TextInput>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    if (visible) {
      setText('');
      setSelectedDays(ALL_DAYS);
      setSelectedHour(7);
      setSelectedMinute(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleEveryDay = () => {
    setSelectedDays((prev) => (prev.length === 7 ? [] : ALL_DAYS));
  };

  const applyPreset = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
  };

  const incrementHour = (delta: number) => setSelectedHour((prev) => (prev + delta + 24) % 24);
  const incrementMinute = (delta: number) => setSelectedMinute((prev) => (prev + delta + 60) % 60);

  const isValid = text.trim().length > 0 && selectedDays.length > 0;

  const handleSave = () => {
    if (!isValid) return;
    onAddHabit(text.trim(), selectedHour, selectedMinute, selectedDays);
    setText('');
    onClose();
  };

  const daysSummary =
    selectedDays.length === 0
      ? 'Pick at least one day'
      : selectedDays.length === 7
      ? 'Every day'
      : selectedDays.map((d) => DAY_LABELS[d]).join(', ');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>🔁 Add Daily Task</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={styles.sectionLabel}>Task Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="e.g. Gym, Study, Read"
                placeholderTextColor="#555577"
                value={text}
                onChangeText={setText}
                maxLength={100}
                autoCorrect
              />
            </View>

            <Text style={styles.sectionLabel}>Repeat On</Text>
            <View style={styles.dayRow}>
              <TouchableOpacity
                style={[styles.dayChip, styles.everyDayChip, selectedDays.length === 7 && styles.dayChipSelected]}
                onPress={toggleEveryDay}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayChipText, selectedDays.length === 7 && styles.dayChipTextSelected]}>
                  Every day
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, index) => {
                const selected = selectedDays.includes(index);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.dayChip, selected && styles.dayChipSelected]}
                    onPress={() => toggleDay(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.daysSummary}>{daysSummary}</Text>

            <View style={styles.timeHeaderRow}>
              <Text style={styles.sectionLabel}>Time (24-Hour)</Text>
              <View style={styles.quickAdjustRow}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => incrementMinute(-1)}>
                  <Text style={styles.adjustBtnText}>-1m</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => incrementMinute(1)}>
                  <Text style={styles.adjustBtnText}>+1m</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => incrementHour(1)}>
                  <Text style={styles.adjustBtnText}>+1h</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.presetRow}>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(7, 0)} activeOpacity={0.7}>
                <Text style={styles.presetText}>Morning 07:00</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(12, 0)} activeOpacity={0.7}>
                <Text style={styles.presetText}>Noon 12:00</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(18, 0)} activeOpacity={0.7}>
                <Text style={styles.presetText}>Evening 18:00</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(21, 0)} activeOpacity={0.7}>
                <Text style={styles.presetText}>Night 21:00</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.columnHeader}>Hour (00-23)</Text>
                <ScrollView style={styles.scrollList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.pickerItem, selectedHour === h && styles.pickerItemSelected]}
                      onPress={() => setSelectedHour(h)}
                    >
                      <Text style={[styles.pickerItemText, selectedHour === h && styles.pickerItemTextSelected]}>
                        {h.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeColon}>:</Text>

              <View style={styles.pickerColumn}>
                <Text style={styles.columnHeader}>Minute (00-59)</Text>
                <ScrollView style={styles.scrollList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {minutes.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickerItem, selectedMinute === m && styles.pickerItemSelected]}
                      onPress={() => setSelectedMinute(m)}
                    >
                      <Text style={[styles.pickerItemText, selectedMinute === m && styles.pickerItemTextSelected]}>
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.selectedTimeDisplay}>
                <Text style={styles.selectedTimeTitle}>Selected</Text>
                <Text style={styles.selectedTimeLarge}>
                  {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
                </Text>
                <Text style={styles.selectedTimeSub}>24h format</Text>
              </View>
            </View>

            <View style={[styles.summaryCard, !isValid && styles.summaryCardError]}>
              <Text style={styles.summaryLabel}>
                {!isValid ? '⚠️ Add a name and pick at least one day' : '🔁 Will remind you:'}
              </Text>
              <Text style={[styles.summaryValue, !isValid && styles.summaryValueError]}>
                {daysSummary} at {selectedHour.toString().padStart(2, '0')}:
                {selectedMinute.toString().padStart(2, '0')}
              </Text>
            </View>
          </ScrollView>

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
              <Text style={styles.confirmBtnText}>Add Task</Text>
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
  input: {
    color: '#f0f0f5',
    fontSize: 15,
    lineHeight: 20,
    minHeight: 24,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  dayChip: {
    backgroundColor: '#202038',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303050',
  },
  everyDayChip: {
    paddingHorizontal: 18,
  },
  dayChipSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  dayChipText: {
    color: '#b0b0cc',
    fontSize: 13,
    fontWeight: '600',
  },
  dayChipTextSelected: {
    color: '#ffffff',
  },
  daysSummary: {
    fontSize: 12,
    color: '#8b8ba7',
    marginBottom: 4,
    marginTop: 2,
  },
  timeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  quickAdjustRow: {
    flexDirection: 'row',
    gap: 6,
  },
  adjustBtn: {
    backgroundColor: '#24243e',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#383858',
  },
  adjustBtnText: {
    color: '#8b5cf6',
    fontSize: 11,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  presetChip: {
    backgroundColor: '#202038',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#303050',
  },
  presetText: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: '600',
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1b1b2e',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#2a2a40',
    marginVertical: 4,
  },
  pickerColumn: {
    width: 80,
    alignItems: 'center',
  },
  columnHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: '#717196',
    marginBottom: 4,
  },
  scrollList: {
    height: 110,
  },
  pickerItem: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: '#8b5cf6',
  },
  pickerItemText: {
    color: '#9e9eb8',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerItemTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  timeColon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#8b5cf6',
    marginTop: 14,
  },
  selectedTimeDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#232338',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#383858',
    marginLeft: 6,
  },
  selectedTimeTitle: {
    fontSize: 10,
    color: '#8b8ba7',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedTimeLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: '#8b5cf6',
    marginVertical: 2,
    letterSpacing: 1,
  },
  selectedTimeSub: {
    fontSize: 9,
    color: '#717196',
  },
  summaryCard: {
    backgroundColor: '#202036',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#303050',
    alignItems: 'center',
  },
  summaryCardError: {
    backgroundColor: '#2d1b1b',
    borderColor: '#6b2020',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#8b8ba7',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8b5cf6',
    textAlign: 'center',
  },
  summaryValueError: {
    color: '#ef4444',
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
  confirmBtn: {
    flex: 2,
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#332e40',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
