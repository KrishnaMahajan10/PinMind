import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  setupNotificationHandler,
  createNotificationChannels,
  requestPermissions,
} from './utils/notifications';
import { useReminders } from './hooks/useReminders';
import { useHabits } from './hooks/useHabits';
import { useLists } from './hooks/useLists';
import { useSecretNotes, SecretNote } from './hooks/useSecretNotes';
import { getHabitProgress } from './utils/habitStats';
import ReminderCard from './components/ReminderCard';
import HistoryCard from './components/HistoryCard';
import ScheduledReminderCard from './components/ScheduledReminderCard';
import HabitCard from './components/HabitCard';
import ListCard from './components/ListCard';
import ListItemRow from './components/ListItemRow';
import NoteCard from './components/NoteCard';
import AddReminderModal from './components/AddReminderModal';
import AddHabitModal from './components/AddHabitModal';
import AddListModal from './components/AddListModal';
import AddNoteModal from './components/AddNoteModal';
import SecretNotePinScreen from './components/SecretNotePinScreen';
import AnimatedSplash from './components/AnimatedSplash';

type Tab = 'active' | 'tasks' | 'history' | 'remind_me' | 'lists' | 'notes';

// 'notes' is deliberately excluded from this list: it's a hidden section with
// no visible tab, entry, or icon anywhere — the only way in is holding the
// "PinMind" title for 5 seconds (see the header title's onLongPress below).
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'active', label: 'Active', icon: '📌' },
  { key: 'tasks', label: 'Tasks', icon: '🔁' },
  { key: 'history', label: 'History', icon: '✅' },
  { key: 'remind_me', label: 'Remind Me', icon: '⏰' },
  { key: 'lists', label: 'Lists', icon: '📋' },
];

const SECRET_NOTES_HOLD_MS = 5000;

export default function App() {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [addReminderModalVisible, setAddReminderModalVisible] = useState(false);
  const [addHabitModalVisible, setAddHabitModalVisible] = useState(false);
  const [addListModalVisible, setAddListModalVisible] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listItemInputText, setListItemInputText] = useState('');
  const [addNoteModalVisible, setAddNoteModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<SecretNote | null>(null);
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

  const {
    habits,
    completions,
    loading: habitsLoading,
    addHabit,
    deleteHabit,
    toggleHabitToday,
  } = useHabits();

  const {
    lists,
    items: listItems,
    loading: listsLoading,
    addList,
    deleteList,
    toggleListLinked,
    addItem: addListItem,
    toggleItemDone: toggleListItemDone,
    deleteItem: deleteListItem,
  } = useLists();

  const {
    hasPin: notesHasPin,
    locked: notesLocked,
    notes,
    loading: notesLoading,
    setupPin: setupNotesPin,
    unlock: unlockNotes,
    lock: lockNotes,
    resetAll: resetNotes,
    addNote,
    updateNote,
    deleteNote,
  } = useSecretNotes();

  const inputRef = useRef<TextInput>(null);
  const listItemInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const isLoading = loading || habitsLoading || listsLoading || notesLoading;
  const selectedList = selectedListId ? lists.find((l) => l.id === selectedListId) ?? null : null;
  const selectedListItems = selectedListId
    ? listItems.filter((i) => i.listId === selectedListId)
    : [];

  // Re-lock the secret notes whenever the app leaves the foreground, so
  // they're never left open in the background/app-switcher.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        lockNotes();
      }
    });
    return () => subscription.remove();
  }, [lockNotes]);

  // Once locked, any note editor still open would try to save against a
  // cleared in-memory PIN and silently no-op — close it instead.
  useEffect(() => {
    if (notesLocked) {
      setAddNoteModalVisible(false);
      setEditingNote(null);
    }
  }, [notesLocked]);

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

  const handleAddHabitFromModal = async (
    text: string,
    hour: number,
    minute: number,
    days: number[]
  ) => {
    const permitted = await ensurePermissions();
    if (!permitted) return;

    await addHabit(text, hour, minute, days);
    setActiveTab('tasks');
  };

  const handleDeleteHabit = (id: string) => {
    Alert.alert(
      'Remove Task',
      'This will also cancel its daily reminder and delete its history. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteHabit(id),
        },
      ]
    );
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

  const handleAddListFromModal = async (name: string) => {
    await addList(name);
  };

  const handleOpenList = (id: string) => {
    setSelectedListId(id);
  };

  const handleBackToLists = () => {
    setSelectedListId(null);
    setListItemInputText('');
  };

  const handleDeleteList = (id: string) => {
    const target = lists.find((l) => l.id === id);
    Alert.alert(
      'Delete List',
      `This will delete "${target?.name ?? 'this list'}" and all its items. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (selectedListId === id) setSelectedListId(null);
            deleteList(id);
          },
        },
      ]
    );
  };

  const handleAddListItem = async () => {
    const trimmed = listItemInputText.trim();
    if (!trimmed || !selectedListId) return;
    await addListItem(selectedListId, trimmed);
    setListItemInputText('');
    listItemInputRef.current?.blur();
  };

  const handleOpenAddNote = () => {
    setEditingNote(null);
    setAddNoteModalVisible(true);
  };

  const handleOpenEditNote = (note: SecretNote) => {
    setEditingNote(note);
    setAddNoteModalVisible(true);
  };

  const handleSaveNote = (title: string, description: string) => {
    if (editingNote) {
      updateNote(editingNote.id, title, description);
    } else {
      addNote(title, description);
    }
  };

  const handleDeleteNote = () => {
    if (!editingNote) return;
    const target = editingNote;
    Alert.alert('Delete Note', `Delete "${target.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteNote(target.id);
          setAddNoteModalVisible(false);
        },
      },
    ]);
  };

  const handleForgotNotesPin = () => {
    Alert.alert(
      'Reset Notes',
      'Without the PIN there is no way to recover these notes. Resetting will permanently delete all of them and let you set a new PIN. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete & Reset', style: 'destructive', onPress: () => resetNotes() },
      ]
    );
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
      case 'tasks':
        return habits.length === 0
          ? 'No daily tasks yet'
          : `${habits.length} daily task${habits.length > 1 ? 's' : ''} tracked`;
      case 'lists':
        if (selectedList) {
          const undone = selectedListItems.filter((i) => !i.done).length;
          return selectedListItems.length === 0
            ? 'No items yet'
            : `${undone} item${undone !== 1 ? 's' : ''} left`;
        }
        return lists.length === 0
          ? 'No lists yet'
          : `${lists.length} list${lists.length > 1 ? 's' : ''}`;
      case 'notes':
        if (!notesHasPin) return 'Set up your private notes';
        if (notesLocked) return '🔒 Locked';
        return notes.length === 0
          ? 'No private notes yet'
          : `${notes.length} private note${notes.length > 1 ? 's' : ''}`;
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
            <TouchableOpacity
              onLongPress={() => setActiveTab('notes')}
              delayLongPress={SECRET_NOTES_HOLD_MS}
              activeOpacity={1}
            >
              <Text style={styles.headerTitle}>PinMind</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>{getSubtitle()}</Text>

          {/* Tab Bar: horizontally scrolling chips so it scales past a handful of tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

        {/* Action Header for Tasks Tab */}
        {activeTab === 'tasks' && (
          <Animated.View
            style={[
              styles.actionHeaderWrapper,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              style={[styles.addReminderTriggerBtn, styles.addHabitTriggerBtn]}
              onPress={() => setAddHabitModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addReminderTriggerIcon}>🔁</Text>
              <Text style={styles.addReminderTriggerText}>Add Task</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Action Header for Lists Tab (root: list of lists) */}
        {activeTab === 'lists' && !selectedList && (
          <Animated.View
            style={[
              styles.actionHeaderWrapper,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              style={[styles.addReminderTriggerBtn, styles.addListTriggerBtn]}
              onPress={() => setAddListModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addReminderTriggerIcon}>📋</Text>
              <Text style={styles.addReminderTriggerText}>New List</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* List Detail Header (a list is open: back nav, link toggle, add item) */}
        {activeTab === 'lists' && selectedList && (
          <Animated.View
            style={[
              styles.listDetailHeaderWrapper,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.listDetailTopRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBackToLists}
                activeOpacity={0.7}
                accessibilityLabel="Back to all lists"
              >
                <Text style={styles.backBtnText}>‹ Lists</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.linkToggle, selectedList.linked && styles.linkToggleActive]}
                onPress={() => toggleListLinked(selectedList.id)}
                activeOpacity={0.8}
                accessibilityLabel={
                  selectedList.linked
                    ? 'Unlink this list from the To Do notification'
                    : 'Link this list to the To Do notification'
                }
              >
                <Text
                  style={[
                    styles.linkToggleText,
                    selectedList.linked && styles.linkToggleTextActive,
                  ]}
                >
                  {selectedList.linked ? '📌 Linked' : '📌 Link to Notification'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.listDetailTitle}>{selectedList.name}</Text>

            <View style={styles.inputContainer}>
              <TextInput
                ref={listItemInputRef}
                style={styles.input}
                placeholder="Add an item..."
                placeholderTextColor="#555577"
                value={listItemInputText}
                onChangeText={setListItemInputText}
                onSubmitEditing={handleAddListItem}
                returnKeyType="done"
                maxLength={150}
                autoCorrect
              />
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  styles.addListItemBtn,
                  !listItemInputText.trim() && styles.addBtnDisabled,
                ]}
                onPress={handleAddListItem}
                activeOpacity={0.8}
                disabled={!listItemInputText.trim()}
                accessibilityLabel="Add list item"
              >
                <Text style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Action Header for Notes Tab (only once unlocked) */}
        {activeTab === 'notes' && notesHasPin && !notesLocked && (
          <Animated.View
            style={[
              styles.actionHeaderWrapper,
              styles.notesActionRow,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              style={[styles.addReminderTriggerBtn, styles.addNoteTriggerBtn, styles.notesActionFlex]}
              onPress={handleOpenAddNote}
              activeOpacity={0.8}
            >
              <Text style={styles.addReminderTriggerIcon}>🔒</Text>
              <Text style={styles.addReminderTriggerText}>Add Note</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.lockNowBtn}
              onPress={lockNotes}
              activeOpacity={0.8}
              accessibilityLabel="Lock notes now"
            >
              <Text style={styles.lockNowBtnText}>🔒 Lock</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* List Content */}
        {isLoading ? (
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
        ) : activeTab === 'tasks' ? (
          habits.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <Text style={styles.emptyEmoji}>🔁</Text>
              <Text style={styles.emptyTitle}>No daily tasks yet</Text>
              <Text style={styles.emptyBody}>
                Add a task like Gym or Study to get a daily{'\n'}reminder and track how consistent you are.
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, styles.emptyActionBtnHabit]}
                onPress={() => setAddHabitModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.emptyActionBtnText, styles.emptyActionBtnTextHabit]}>
                  + Add Task
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <FlatList
              data={habits}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <HabitCard
                  habit={item}
                  progress={getHabitProgress(item, completions[item.id] ?? [])}
                  onToggleToday={toggleHabitToday}
                  onDelete={handleDeleteHabit}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
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
        ) : activeTab === 'lists' ? (
          selectedList ? (
            selectedListItems.length === 0 ? (
              <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>Nothing in this list yet</Text>
                <Text style={styles.emptyBody}>
                  Add an item above to start building{'\n'}"{selectedList.name}".
                </Text>
              </Animated.View>
            ) : (
              <FlatList
                data={selectedListItems}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ListItemRow
                    item={item}
                    onToggleDone={toggleListItemDone}
                    onDelete={deleteListItem}
                  />
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )
          ) : lists.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptyBody}>
                Create lists like Shopping or Travel Checklist{'\n'}to keep different kinds of items apart.
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, styles.emptyActionBtnList]}
                onPress={() => setAddListModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.emptyActionBtnText, styles.emptyActionBtnTextList]}>
                  + New List
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <FlatList
              data={lists}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListCard
                  list={item}
                  itemCount={listItems.filter((i) => i.listId === item.id).length}
                  doneCount={listItems.filter((i) => i.listId === item.id && i.done).length}
                  onPress={handleOpenList}
                  onDelete={handleDeleteList}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : activeTab === 'notes' ? (
          !notesHasPin ? (
            <SecretNotePinScreen mode="setup" onSetup={setupNotesPin} />
          ) : notesLocked ? (
            <SecretNotePinScreen mode="unlock" onUnlock={unlockNotes} onForgotPin={handleForgotNotesPin} />
          ) : notes.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <Text style={styles.emptyEmoji}>🔒</Text>
              <Text style={styles.emptyTitle}>No private notes yet</Text>
              <Text style={styles.emptyBody}>
                Add a note above to keep something{'\n'}just for yourself.
              </Text>
            </Animated.View>
          ) : (
            <FlatList
              data={notes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <NoteCard note={item} onPress={handleOpenEditNote} />}
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
        {!isLoading && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {activeTab === 'active'
                ? '🔒 Pinned silently to notification bar • Won\'t vibrate continuously'
                : activeTab === 'remind_me'
                ? '🔔 High-priority alert with sound & vibration at scheduled time'
                : activeTab === 'tasks'
                ? '🔁 Recurring alert on your chosen days • Tap ✓ once you\'re done'
                : activeTab === 'lists'
                ? '📋 Organize items into separate lists • Link one to pin its items to "To Do"'
                : activeTab === 'notes'
                ? '🔒 Encrypted on this device with your PIN • Locks automatically in the background'
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

      {/* Add Daily Task Modal */}
      <AddHabitModal
        visible={addHabitModalVisible}
        onClose={() => setAddHabitModalVisible(false)}
        onAddHabit={handleAddHabitFromModal}
      />

      {/* Add List Modal */}
      <AddListModal
        visible={addListModalVisible}
        onClose={() => setAddListModalVisible(false)}
        onAddList={handleAddListFromModal}
      />

      {/* Add/Edit Secret Note Modal */}
      <AddNoteModal
        visible={addNoteModalVisible}
        onClose={() => setAddNoteModalVisible(false)}
        onSave={handleSaveNote}
        onDelete={editingNote ? handleDeleteNote : undefined}
        initialTitle={editingNote?.title}
        initialDescription={editingNote?.description}
      />

      {showSplash && (
        <AnimatedSplash ready={!isLoading} onFinish={() => setShowSplash(false)} />
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
    marginTop: 16,
    backgroundColor: '#181828',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26263c',
  },
  tabBarContent: {
    flexDirection: 'row',
    padding: 4,
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#f97316',
  },
  tabIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#717196',
    letterSpacing: 0.1,
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
  addHabitTriggerBtn: {
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
  },
  addListTriggerBtn: {
    backgroundColor: '#14b8a6',
    shadowColor: '#14b8a6',
  },
  addNoteTriggerBtn: {
    backgroundColor: '#eab308',
    shadowColor: '#eab308',
  },
  notesActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  notesActionFlex: {
    flex: 1,
  },
  lockNowBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222238',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#30304c',
  },
  lockNowBtnText: {
    color: '#9e9eb8',
    fontSize: 13,
    fontWeight: '700',
  },
  listDetailHeaderWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  listDetailTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  backBtnText: {
    color: '#8b8ba7',
    fontSize: 14,
    fontWeight: '600',
  },
  linkToggle: {
    backgroundColor: '#202038',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#303050',
  },
  linkToggleActive: {
    backgroundColor: '#0f3d38',
    borderColor: '#14b8a6',
  },
  linkToggleText: {
    color: '#8b8ba7',
    fontSize: 12,
    fontWeight: '700',
  },
  linkToggleTextActive: {
    color: '#14b8a6',
  },
  listDetailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f0f0f5',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  addListItemBtn: {
    backgroundColor: '#14b8a6',
  },
  emptyActionBtnList: {
    borderColor: '#14b8a6',
  },
  emptyActionBtnTextList: {
    color: '#14b8a6',
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
  emptyActionBtnHabit: {
    borderColor: '#8b5cf6',
  },
  emptyActionBtnTextHabit: {
    color: '#8b5cf6',
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
