import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

interface AnimatedSplashProps {
  ready: boolean;
  onFinish: () => void;
  minDurationMs?: number;
}

export default function AnimatedSplash({
  ready,
  onFinish,
  minDurationMs = 1800,
}: AnimatedSplashProps) {
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const creditOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const minTimeElapsedRef = useRef(false);
  const readyRef = useRef(ready);
  const finishedRef = useRef(false);
  readyRef.current = ready;

  const tryFinish = () => {
    if (finishedRef.current) return;
    if (!minTimeElapsedRef.current || !readyRef.current) return;
    finishedRef.current = true;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => onFinish());
  };

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(creditOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      minTimeElapsedRef.current = true;
      tryFinish();
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) tryFinish();
  }, [ready]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.Image
        source={require('../assets/splash-icon.png')}
        style={[
          styles.icon,
          { opacity: iconOpacity, transform: [{ scale: iconScale }] },
        ]}
        resizeMode="contain"
      />
      <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>PinMind</Animated.Text>
      <Animated.Text style={[styles.credit, { opacity: creditOpacity }]}>
        Designed and implemented by Krishna Mahajan
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d1a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  icon: {
    width: 140,
    height: 140,
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f0f0f5',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  credit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b6b8a',
    letterSpacing: 0.3,
  },
});
