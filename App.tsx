import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  setupNotificationHandler,
  createNotificationChannels,
  requestPermissions,
} from './utils/notifications';
import { useReminders } from './hooks/useReminders';
import ReminderCard from './components/ReminderCard';
import HistoryCard from './components/HistoryCard';
import ScheduledReminderCard from './components/ScheduledReminderCard';
import AddReminderModal from './components/AddReminderModal';
import AnimatedSplash from './components/AnimatedSplash';

type Tab = 'active' | 'history' | 'remind_me';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [addReminderModalVisible, setAddReminderModalVisible] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const {
    reminders,
    scheduledReminders,
    history,
    loading,
    addReminder,
    addScheduledReminder,
    deleteReminder,
    deleteScheduledReminder,
    promoteScheduledToActive,
    markAsDone,
  } = useReminders();

  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Initialize notifications on mount
    (async () => {
      setupNotificationHandler();
      await createNotificationChannels();
      const granted = await requestPermissions();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please allow notifications so your reminders can be pinned to your notification bar and trigger scheduled alerts.',
          [{ text: 'OK' }]
        );
      }
    })();

    // Listen for incoming notifications & responses
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'timed-alert' && data.reminderId) {
        promoteScheduledToActive(data.reminderId as string);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.reminderId) {
        promoteScheduledToActive(data.reminderId as string);
      }
    });

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [promoteScheduledToActive]);

  const ensurePermissions = async (): Promise<boolean> => {
    let granted = permissionGranted;
    if (!granted) {
      granted = await requestPermissions();
      setPermissionGranted(granted);
    }
    if (!granted) {
      Alert.alert(
        'Permission Needed',
        'Notification permission is needed so reminders can be pinned and alert you on time.'
      );
      return false;
    }
    return true;
  };

  const handleAddActive = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const permitted = await ensurePermissions();
    if (!permitted) return;

    await addReminder(trimmed);
    setInputText('');
    inputRef.current?.blur();
  };

  const handleAddScheduledFromModal = async (text: string, timestamp: number) => {
    const permitted = await ensurePermissions();
    if (!permitted) return;

    await addScheduledReminder(text, timestamp);
    // Switch to Remind Me tab so user immediately sees their created reminder
    setActiveTab('remind_me');
  };

  const handleDeleteActive = (id: string) => {
    Alert.alert(
      'Remove Reminder',
      'This will also remove it from your notification bar. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteReminder(id),
        },
      ]
    );
  };

  const handleDeleteScheduled = (id: string) => {
    Alert.alert(
      'Cancel Scheduled Alert',
      'This will cancel the upcoming reminder alert. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel Alert',
          style: 'destructive',
          onPress: () => deleteScheduledReminder(id),
        },
      ]
    );
  };

  const handlePromoteScheduled = (id: string) => {
    promoteScheduledToActive(id);
  };

  const handleMarkDone = (id: string) => {
    markAsDone(id);
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'active':
        return reminders.length === 0
          ? 'No active reminders'
          : `${reminders.length} silent reminder${reminders.length > 1 ? 's' : ''} pinned`;
      case 'history':
        return history.length === 0
          ? 'No completed reminders'
          : `${history.length} completed reminder${history.length > 1 ? 's' : ''}`;
      case 'remind_me':
        return scheduledReminders.length === 0
          ? 'No scheduled alerts'
          : `${scheduledReminders.length} scheduled alert${scheduledReminders.length > 1 ? 's' : ''}`;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.headerTitleRow}>
            <Image
              source={require('./assets/icon-mark.png')}
              style={styles.headerMark}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>PinMind</Text>
          </View>
          <Text style={styles.headerSubtitle}>{getSubtitle()}</Text>

          {/* 3-Tab Bar: Active | History (Middle) | Remind Me */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'active' && styles.tabActive]}
              onPress={() => setActiveTab('active')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.tabActive]}
              onPress={() => setActiveTab('history')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'remind_me' && styles.tabActive]}
              onPress={() => setActiveTab('remind_me')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'remind_me' && styles.tabTextActive]}>
                Remind Me
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Input Area for Active Tab */}
        {activeTab === 'active' && (
          <Animated.View
            style={[
              styles.inputWrapper,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Type a silent pinned note..."
                placeholderTextColor="#555577"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleAddActive}
                returnKeyType="done"
                multiline={false}
                maxLength={200}
                autoCorrect
              />
              <TouchableOpacity
                style={[styles.addBtn, !inputText.trim() && styles.addBtnDisabled]}
                onPress={handleAddActive}
                activeOpacity={0.8}
                disabled={!inputText.trim()}
                accessibilityLabel="Add silent pinned note"
              >
                <Text style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Action Header for Remind Me Tab */}
        {activeTab === 'remind_me' && (
          <Animated.View
            style={[
              styles.actionHeaderWrapper,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              style={styles.addReminderTriggerBtn}
              onPress={() => setAddReminderModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addReminderTriggerIcon}>⏰</Text>
              <Text style={styles.addReminderTriggerText}>Add Reminder</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* List Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : activeTab === 'active' ? (
          reminders.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <Text style={styles.emptyEmoji}>📌</Text>
              <Text style={styles.emptyTitle}>Nothing pinned yet</Text>
              <Text style={styles.emptyBody}>
                Add a note above to pin it silently in your{'\n'}notification bar without vibrations.
              </Text>
            </Animated.View>
          ) : (
            <FlatList
              data={reminders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ReminderCard
                  reminder={item}
                  onDelete={handleDeleteActive}
                  onMarkDone={handleMarkDone}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )
        ) : activeTab === 'history' ? (
          history.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyBody}>
                Completed reminders will appear here{'\n'}with their completion date & time.
              </Text>
            </Animated.View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <HistoryCard entry={item} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : scheduledReminders.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <Text style={styles.emptyEmoji}>⏰</Text>
            <Text style={styles.emptyTitle}>No scheduled reminders</Text>
            <Text style={styles.emptyBody}>
              Tap "Add Reminder" to set an individual note with its date & time alert.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setAddReminderModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionBtnText}>+ Add Reminder</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <FlatList
            data={scheduledReminders}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ScheduledReminderCard
                reminder={item}
                onDelete={handleDeleteScheduled}
                onPinNow={handlePromoteScheduled}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Footer info note */}
        {!loading && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {activeTab === 'active'
                ? '🔒 Pinned silently to notification bar • Won\'t vibrate continuously'
                : activeTab === 'remind_me'
                ? '🔔 High-priority alert with sound & vibration at scheduled time'
                : '💾 History is saved locally on your device'}
            </Text>
            <Text style={styles.footerCreditText}>Designed and implemented by Krishna Mahajan</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Unified Add Reminder Modal (Note + Timing) */}
      <AddReminderModal
        visible={addReminderModalVisible}
        onClose={() => setAddReminderModalVisible(false)}
        onAddReminder={handleAddScheduledFromModal}
      />

      {showSplash && (
        <AnimatedSplash ready={!loading} onFinish={() => setShowSplash(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMark: {
    width: 21,
    height: 33,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f0f0f5',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#717196',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: '#181828',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#26263c',
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#717196',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  inputWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#181828',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a40',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#f0f0f5',
    letterSpacing: 0.1,
  },
  addBtn: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f97316',
  },
  addBtnDisabled: {
    backgroundColor: '#26263c',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
  actionHeaderWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  addReminderTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addReminderTriggerIcon: {
    fontSize: 18,
  },
  addReminderTriggerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  listContent: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerCreditText: {
    fontSize: 10,
    color: '#3a3a54',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0f0f5',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 13,
    color: '#717196',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#222238',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
    marginTop: 8,
  },
  emptyActionBtnText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#424260',
    textAlign: 'center',
    lineHeight: 16,
  },
});
