import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';

const MIN_PIN_LENGTH = 4;

interface SecretNotePinScreenProps {
  mode: 'setup' | 'unlock';
  onSetup?: (pin: string) => void;
  onUnlock?: (pin: string) => Promise<boolean>;
  onForgotPin?: () => void;
}

export default function SecretNotePinScreen({
  mode,
  onSetup,
  onUnlock,
  onForgotPin,
}: SecretNotePinScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const runShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    setError('');

    if (mode === 'setup') {
      if (pin.length < MIN_PIN_LENGTH) {
        setError(`PIN must be at least ${MIN_PIN_LENGTH} digits`);
        runShake();
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        runShake();
        return;
      }
      onSetup?.(pin);
      return;
    }

    if (!onUnlock) return;
    setSubmitting(true);
    const ok = await onUnlock(pin);
    setSubmitting(false);
    if (!ok) {
      setError('Incorrect PIN');
      setPin('');
      runShake();
    }
  };

  const isValid =
    mode === 'setup'
      ? pin.length >= MIN_PIN_LENGTH && confirmPin.length >= MIN_PIN_LENGTH
      : pin.length >= MIN_PIN_LENGTH;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] },
        ]}
      >
        <Text style={styles.emoji}>🔒</Text>
        <Text style={styles.title}>
          {mode === 'setup' ? 'Protect Your Notes' : 'Enter Your PIN'}
        </Text>
        <Text style={styles.body}>
          {mode === 'setup'
            ? 'Set a PIN to keep this section private. Notes are encrypted on this device — there is no recovery if you forget it.'
            : 'This section is locked for your privacy.'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={mode === 'setup' ? 'New PIN' : 'PIN'}
          placeholderTextColor="#555577"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
        />

        {mode === 'setup' && (
          <TextInput
            style={styles.input}
            placeholder="Confirm PIN"
            placeholderTextColor="#555577"
            value={confirmPin}
            onChangeText={setConfirmPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
          />
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, (!isValid || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {mode === 'setup' ? 'Set PIN' : 'Unlock'}
          </Text>
        </TouchableOpacity>

        {mode === 'unlock' && onForgotPin && (
          <TouchableOpacity onPress={onForgotPin} activeOpacity={0.7} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#f0f0f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    color: '#8b8ba7',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#1c1c30',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d48',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 4,
    color: '#f0f0f5',
    textAlign: 'center',
    marginBottom: 10,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 2,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#eab308',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#3a3624',
  },
  submitBtnText: {
    color: '#0d0d1a',
    fontSize: 15,
    fontWeight: '700',
  },
  forgotBtn: {
    marginTop: 16,
    padding: 4,
  },
  forgotText: {
    color: '#6b6b8a',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
