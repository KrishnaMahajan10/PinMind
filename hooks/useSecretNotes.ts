import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const STORAGE_KEY = '@secret_notes_blob';

export interface SecretNote {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

// crypto-js's passphrase-based AES.encrypt(text, pin) derives its key via a
// RANDOM salt (CryptoJS.lib.WordArray.random), which needs a secure RNG that
// neither React Native nor Hermes provide out of the box — it silently falls
// back to a weaker source there, and on some devices that path misbehaves
// enough that a blob encrypted with a PIN can't reliably be decrypted with
// the very same PIN. Deriving the key and IV deterministically from the PIN
// via SHA-256 instead means no randomness is ever involved, so it behaves
// identically on every platform.
function deriveKey(pin: string): CryptoJS.lib.WordArray {
  return CryptoJS.SHA256(`pinmind-notes-key:${pin}`);
}

function deriveIv(pin: string): CryptoJS.lib.WordArray {
  const hash = CryptoJS.SHA256(`pinmind-notes-iv:${pin}`);
  return CryptoJS.lib.WordArray.create(hash.words.slice(0, 4), 16);
}

function encryptNotes(notes: SecretNote[], pin: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(notes), deriveKey(pin), {
    iv: deriveIv(pin),
  }).toString();
}

/** Returns null when the blob can't be decrypted with this PIN (wrong PIN or corrupt data). */
function decryptNotes(blob: string, pin: string): SecretNote[] | null {
  try {
    const text = CryptoJS.AES.decrypt(blob, deriveKey(pin), { iv: deriveIv(pin) }).toString(
      CryptoJS.enc.Utf8
    );
    if (!text) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Custom hook for a PIN-locked, on-device-encrypted "secret" notes section.
 * The PIN itself is never persisted anywhere — only the AES-encrypted notes
 * blob is. Unlocking means successfully decrypting that blob with the
 * entered PIN; the PIN is then held in a ref (in memory only) for the rest
 * of the unlocked session so edits can be re-encrypted without re-prompting.
 * Locking (manual, or when the app backgrounds) clears both the decrypted
 * notes and the in-memory PIN, so there's no recovery without it — forgetting
 * the PIN means wiping and starting over (see resetAll).
 */
export function useSecretNotes() {
  const [hasPin, setHasPin] = useState(false);
  const [locked, setLocked] = useState(true);
  const [notes, setNotes] = useState<SecretNote[]>([]);
  const [loading, setLoading] = useState(true);
  const pinRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const blob = await AsyncStorage.getItem(STORAGE_KEY);
        setHasPin(!!blob);
      } catch (e) {
        console.error('Failed to check secret notes setup', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (updated: SecretNote[]) => {
    if (!pinRef.current) return;
    setNotes(updated);
    await AsyncStorage.setItem(STORAGE_KEY, encryptNotes(updated, pinRef.current));
  }, []);

  // First-time setup: the PIN just entered becomes the permanent PIN.
  const setupPin = useCallback(async (pin: string) => {
    pinRef.current = pin;
    setNotes([]);
    setHasPin(true);
    setLocked(false);
    await AsyncStorage.setItem(STORAGE_KEY, encryptNotes([], pin));
  }, []);

  // Attempt to unlock with a PIN. Returns whether it was correct.
  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const blob = await AsyncStorage.getItem(STORAGE_KEY);
      if (!blob) return false;
      const decrypted = decryptNotes(blob, pin);
      if (!decrypted) return false;
      pinRef.current = pin;
      setNotes(decrypted);
      setLocked(false);
      return true;
    } catch (e) {
      console.error('Failed to unlock secret notes', e);
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    pinRef.current = null;
    setNotes([]);
    setLocked(true);
  }, []);

  // Forgot-PIN fallback: without the PIN the existing notes can never be
  // decrypted again, so the only way out is to wipe them and start fresh.
  const resetAll = useCallback(async () => {
    pinRef.current = null;
    setNotes([]);
    setHasPin(false);
    setLocked(true);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const addNote = useCallback(
    async (title: string, description: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const now = Date.now();
      const newNote: SecretNote = {
        id: `note_${now}_${Math.random().toString(36).slice(2, 7)}`,
        title: trimmedTitle,
        description: description.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await persist([newNote, ...notes]);
    },
    [notes, persist]
  );

  const updateNote = useCallback(
    async (id: string, title: string, description: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const updated = notes.map((n) =>
        n.id === id
          ? { ...n, title: trimmedTitle, description: description.trim(), updatedAt: Date.now() }
          : n
      );
      await persist(updated);
    },
    [notes, persist]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await persist(notes.filter((n) => n.id !== id));
    },
    [notes, persist]
  );

  return {
    hasPin,
    locked,
    notes,
    loading,
    setupPin,
    unlock,
    lock,
    resetAll,
    addNote,
    updateNote,
    deleteNote,
  };
}
