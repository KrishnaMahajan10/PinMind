import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncLinkedListItemsToNotifications } from '../utils/notifications';

const LISTS_STORAGE_KEY = '@lists';
const LIST_ITEMS_STORAGE_KEY = '@list_items';

/** Prefix for every ListItem id, so other features can tell a list item apart
 * from a plain reminder id when both show up in the shared native pin store. */
export const LIST_ITEM_ID_PREFIX = 'listitem_';

export interface CustomList {
  id: string;
  name: string;
  createdAt: number;
  /** When true, this list's undone items are pinned into the "To Do" notification. */
  linked: boolean;
}

export interface ListItem {
  id: string;
  listId: string;
  text: string;
  done: boolean;
  createdAt: number;
}

function pinnableItems(lists: CustomList[], items: ListItem[]) {
  const linkedListIds = new Set(lists.filter((l) => l.linked).map((l) => l.id));
  return items
    .filter((i) => !i.done && linkedListIds.has(i.listId))
    .map((i) => ({ id: i.id, text: i.text, createdAt: i.createdAt }));
}

/**
 * Custom hook that manages multiple named custom lists (Shopping, Travel
 * Checklist, ...) and their items. A list can optionally be "linked", which
 * mirrors its undone items into the same pinned "To Do" notification used by
 * plain reminders (see utils/notifications.ts: syncLinkedListItemsToNotifications).
 */
export function useLists() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rawLists, rawItems] = await Promise.all([
          AsyncStorage.getItem(LISTS_STORAGE_KEY),
          AsyncStorage.getItem(LIST_ITEMS_STORAGE_KEY),
        ]);
        const loadedLists: CustomList[] = rawLists ? JSON.parse(rawLists) : [];
        const loadedItems: ListItem[] = rawItems ? JSON.parse(rawItems) : [];
        setLists(loadedLists);
        setItems(loadedItems);
        await syncLinkedListItemsToNotifications(pinnableItems(loadedLists, loadedItems));
      } catch (e) {
        console.error('Failed to load lists', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist both arrays together and re-sync the pinned notification, since a
  // change to either lists (linking/unlinking) or items can affect what's pinned.
  const persist = useCallback(async (updatedLists: CustomList[], updatedItems: ListItem[]) => {
    await Promise.all([
      AsyncStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(updatedLists)),
      AsyncStorage.setItem(LIST_ITEMS_STORAGE_KEY, JSON.stringify(updatedItems)),
    ]);
    await syncLinkedListItemsToNotifications(pinnableItems(updatedLists, updatedItems));
  }, []);

  const addList = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const newList: CustomList = {
        id: `list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        createdAt: Date.now(),
        linked: false,
      };

      const updated = [newList, ...lists];
      setLists(updated);
      await persist(updated, items);
    },
    [lists, items, persist]
  );

  const deleteList = useCallback(
    async (id: string) => {
      const updatedLists = lists.filter((l) => l.id !== id);
      const updatedItems = items.filter((i) => i.listId !== id);
      setLists(updatedLists);
      setItems(updatedItems);
      await persist(updatedLists, updatedItems);
    },
    [lists, items, persist]
  );

  // Toggle whether this list's undone items pin to the "To Do" notification.
  const toggleListLinked = useCallback(
    async (id: string) => {
      const updated = lists.map((l) => (l.id === id ? { ...l, linked: !l.linked } : l));
      setLists(updated);
      await persist(updated, items);
    },
    [lists, items, persist]
  );

  const addItem = useCallback(
    async (listId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const newItem: ListItem = {
        id: `${LIST_ITEM_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        listId,
        text: trimmed,
        done: false,
        createdAt: Date.now(),
      };

      const updated = [newItem, ...items];
      setItems(updated);
      await persist(lists, updated);
    },
    [items, lists, persist]
  );

  const toggleItemDone = useCallback(
    async (id: string) => {
      const updated = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
      setItems(updated);
      await persist(lists, updated);
    },
    [items, lists, persist]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const updated = items.filter((i) => i.id !== id);
      setItems(updated);
      await persist(lists, updated);
    },
    [items, lists, persist]
  );

  return {
    lists,
    items,
    loading,
    addList,
    deleteList,
    toggleListLinked,
    addItem,
    toggleItemDone,
    deleteItem,
  };
}
