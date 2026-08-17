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

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onAddReminder: (text: string, scheduledTimestamp: number) => void;
  initialText?: string;
}

export default function AddReminderModal({
  visible,
  onClose,
  onAddReminder,
  initialText = '',
}: AddReminderModalProps) {
  const [text, setText] = useState(initialText);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    const h = new Date().getHours();
    return h;
  });
  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    const m = (new Date().getMinutes() + 1) % 60;
    return m;
  });

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'days' | 'months'>('days');
  const [pickerYear, setPickerYear] = useState<number>(() => new Date().getFullYear());

  const inputRef = useRef<TextInput>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const getMonthMatrix = (monthStart: Date): (Date | null)[][] => {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstDay.getDay() + 6) % 7;

    const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  };

  const monthMatrix = getMonthMatrix(viewMonth);
  const isCurrentMonthView =
    viewMonth.getFullYear() === todayStart.getFullYear() &&
    viewMonth.getMonth() === todayStart.getMonth();

  const goToMonth = (delta: number) => {
    setViewMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      const floor = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
      return next < floor ? floor : next;
    });
  };

  const formatMonthLabel = (d: Date) =>
    d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Initialize or reset values when modal opens
  useEffect(() => {
    if (visible) {
      setText(initialText);
      const base = new Date(Date.now() + 15 * 60 * 1000);
      setSelectedDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()));
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      setSelectedHour(base.getHours());
      setSelectedMinute(base.getMinutes());
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible, initialText]);

  // Compute final scheduled timestamp
  const getCalculatedTimestamp = () => {
    const d = new Date(selectedDate);
    d.setHours(selectedHour, selectedMinute, 0, 0);
    return d.getTime();
  };

  const calculatedTime = getCalculatedTimestamp();
  const isPast = calculatedTime <= Date.now();
  const isValid = text.trim().length > 0 && !isPast;

  const handleApplyPreset = (minutesToAdd: number, specificHour?: number) => {
    const target = new Date();
    if (specificHour !== undefined) {
      if (specificHour <= target.getHours()) {
        target.setDate(target.getDate() + 1);
      }
      target.setHours(specificHour, 0, 0, 0);
    } else {
      target.setTime(target.getTime() + minutesToAdd * 60 * 1000);
    }

    setSelectedDate(new Date(target.getFullYear(), target.getMonth(), target.getDate()));
    setViewMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    setSelectedHour(target.getHours());
    setSelectedMinute(target.getMinutes());
  };

  const incrementHour = (delta: number) => {
    setSelectedHour((prev) => (prev + delta + 24) % 24);
  };

  const incrementMinute = (delta: number) => {
    setSelectedMinute((prev) => (prev + delta + 60) % 60);
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed || isPast) return;
    onAddReminder(trimmed, calculatedTime);
    setText('');
    onClose();
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatDayLabel = (date: Date, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const handlePickFromCalendar = (d: Date) => {
    setSelectedDate(d);
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const openMonthYearPicker = () => {
    setPickerYear(viewMonth.getFullYear());
    setPickerMode('months');
  };

  const closeCalendarPopup = () => {
    setCalendarVisible(false);
    setPickerMode('days');
  };

  const goToPickerYear = (delta: number) => {
    setPickerYear((prev) => Math.max(prev + delta, todayStart.getFullYear()));
  };

  const handlePickMonth = (monthIndex: number) => {
    setViewMonth(new Date(pickerYear, monthIndex, 1));
    setPickerMode('days');
  };

  const format24hSummary = (timestamp: number) => {
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${dateStr}, ${h}:${m}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.container}>
          {/* Modal Header */}
          <View style={styles.header}>
            <Text style={styles.title}>⏰ Add Reminder</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
          >
            {/* Note / Message Input */}
            <Text style={styles.sectionLabel}>Reminder Note / Message</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="What should I remind you about?"
                placeholderTextColor="#555577"
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={2}
                maxLength={250}
                autoCorrect
              />
            </View>

            {/* Quick Timing Presets */}
            <Text style={styles.sectionLabel}>Quick Timing</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(5)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>+5m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(15)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>+15m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(30)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>+30m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(60)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>+1h</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(0, 20)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>Tonight 20:00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(0, 9)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>Tomorrow 09:00</Text>
              </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <View style={styles.dateHeaderRow}>
              <Text style={styles.sectionLabel}>Date</Text>
              <TouchableOpacity
                style={styles.calendarBtn}
                onPress={() => setCalendarVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.calendarBtnText}>📅 Calendar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateRow}
            >
              {days.map((d, index) => {
                const selected = isSameDay(d, selectedDate);
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={[styles.dateChip, selected && styles.dateChipSelected]}
                    onPress={() => setSelectedDate(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>
                      {formatDayLabel(d, index)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 24-Hour Time Selector with 1-minute precision */}
            <View style={styles.timeHeaderRow}>
              <Text style={styles.sectionLabel}>Time (24-Hour • 1 min precision)</Text>
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

            <View style={styles.timePickerContainer}>
              {/* Hours (00 - 23) */}
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

              {/* Minutes (00 - 59) */}
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

              {/* Current Selected Large Display */}
              <View style={styles.selectedTimeDisplay}>
                <Text style={styles.selectedTimeTitle}>Selected</Text>
                <Text style={styles.selectedTimeLarge}>
                  {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
                </Text>
                <Text style={styles.selectedTimeSub}>24h format</Text>
              </View>
            </View>

            {/* Target Summary */}
            <View style={[styles.summaryCard, isPast && styles.summaryCardError]}>
              <Text style={styles.summaryLabel}>
                {isPast ? '⚠️ Selected time is in the past' : '🔔 Alert scheduled for:'}
              </Text>
              <Text style={[styles.summaryValue, isPast && styles.summaryValueError]}>
                {format24hSummary(calculatedTime)}
              </Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
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
              <Text style={styles.confirmBtnText}>Add Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCalendarPopup}
      >
        <TouchableOpacity
          style={styles.calendarBackdrop}
          activeOpacity={1}
          onPress={closeCalendarPopup}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarPopup}>
            {pickerMode === 'days' ? (
              <>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    style={[styles.calendarNavBtn, isCurrentMonthView && styles.calendarNavBtnDisabled]}
                    onPress={() => goToMonth(-1)}
                    disabled={isCurrentMonthView}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={[
                        styles.calendarNavText,
                        isCurrentMonthView && styles.calendarNavTextDisabled,
                      ]}
                    >
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openMonthYearPicker} activeOpacity={0.7}>
                    <Text style={styles.calendarMonthLabel}>{formatMonthLabel(viewMonth)} ▾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.calendarNavBtn}
                    onPress={() => goToMonth(1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.calendarNavText}>›</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.weekdayRow}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((wd) => (
                    <Text key={wd} style={styles.weekdayLabel}>
                      {wd}
                    </Text>
                  ))}
                </View>

                {monthMatrix.map((week, wi) => (
                  <View key={wi} style={styles.calendarWeekRow}>
                    {week.map((d, di) => {
                      if (!d) {
                        return <View key={di} style={styles.dayCell} />;
                      }
                      const isPastDay = d < todayStart;
                      const selected = isSameDay(d, selectedDate);
                      const isToday = isSameDay(d, todayStart);
                      return (
                        <TouchableOpacity
                          key={di}
                          style={[
                            styles.dayCell,
                            selected && styles.dayCellSelected,
                            isPastDay && styles.dayCellDisabled,
                          ]}
                          onPress={() => !isPastDay && handlePickFromCalendar(d)}
                          disabled={isPastDay}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              selected && styles.dayCellTextSelected,
                              isPastDay && styles.dayCellTextDisabled,
                              isToday && !selected && styles.dayCellTextToday,
                            ]}
                          >
                            {d.getDate()}
                          </Text>
                          {isToday && !selected && <View style={styles.todayDot} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : (
              <>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    style={[
                      styles.calendarNavBtn,
                      pickerYear <= todayStart.getFullYear() && styles.calendarNavBtnDisabled,
                    ]}
                    onPress={() => goToPickerYear(-1)}
                    disabled={pickerYear <= todayStart.getFullYear()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={[
                        styles.calendarNavText,
                        pickerYear <= todayStart.getFullYear() && styles.calendarNavTextDisabled,
                      ]}
                    >
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.calendarMonthLabel}>{pickerYear}</Text>
                  <TouchableOpacity
                    style={styles.calendarNavBtn}
                    onPress={() => goToPickerYear(1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.calendarNavText}>›</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                  {monthNamesShort.map((label, idx) => {
                    const isPastMonth =
                      pickerYear === todayStart.getFullYear() && idx < todayStart.getMonth();
                    const selected =
                      pickerYear === viewMonth.getFullYear() && idx === viewMonth.getMonth();
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.monthCell,
                          selected && styles.monthCellSelected,
                          isPastMonth && styles.monthCellDisabled,
                        ]}
                        onPress={() => !isPastMonth && handlePickMonth(idx)}
                        disabled={isPastMonth}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.monthCellText,
                            selected && styles.monthCellTextSelected,
                            isPastMonth && styles.monthCellTextDisabled,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.calendarDoneBtn}
              onPress={closeCalendarPopup}
              activeOpacity={0.8}
            >
              <Text style={styles.calendarDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    minHeight: 44,
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
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarBtn: {
    backgroundColor: '#24243e',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#383858',
  },
  calendarBtnText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 6,
  },
  dateChip: {
    backgroundColor: '#202038',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303050',
  },
  dateChipSelected: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  dateChipText: {
    color: '#b0b0cc',
    fontSize: 13,
    fontWeight: '600',
  },
  dateChipTextSelected: {
    color: '#ffffff',
  },
  calendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  calendarPopup: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1b1b2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a40',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  calendarDoneBtn: {
    marginTop: 10,
    backgroundColor: '#f97316',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarDoneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  monthCell: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#202038',
    borderWidth: 1,
    borderColor: '#303050',
  },
  monthCellSelected: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  monthCellDisabled: {
    opacity: 0.3,
  },
  monthCellText: {
    color: '#e4e4ee',
    fontSize: 13,
    fontWeight: '600',
  },
  monthCellTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  monthCellTextDisabled: {
    color: '#6b6b8a',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  calendarNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#24243e',
    borderWidth: 1,
    borderColor: '#383858',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavBtnDisabled: {
    opacity: 0.35,
  },
  calendarNavText: {
    color: '#f97316',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  calendarNavTextDisabled: {
    color: '#6b6b8a',
  },
  calendarMonthLabel: {
    color: '#f0f0f5',
    fontSize: 14,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#6b6b8a',
    fontSize: 11,
    fontWeight: '600',
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: '#f97316',
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayCellText: {
    color: '#e4e4ee',
    fontSize: 13,
    fontWeight: '600',
  },
  dayCellTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  dayCellTextDisabled: {
    color: '#6b6b8a',
  },
  dayCellTextToday: {
    color: '#f97316',
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f97316',
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
    color: '#f97316',
    fontSize: 11,
    fontWeight: '700',
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
    backgroundColor: '#f97316',
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
    color: '#f97316',
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
    color: '#f97316',
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
    color: '#f97316',
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
    backgroundColor: '#f97316',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#403025',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
