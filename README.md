# PinMind

A reminder app for Android built with Expo and React Native. Reminders can be pinned silently to the notification bar as persistent to-do items, or scheduled as loud "Remind Me" alerts that fire at an exact time — even if the app has been killed.

## Features

- **Active (To Do)** — reminders pinned as a silent, non-dismissible notification, always visible in the notification bar.
- **Remind Me** — schedule a reminder for an exact date and time; it rings with sound and vibration when due.
- **History** — completed reminders are kept locally for reference.
- **Works when the app is killed** — scheduled alerts are backed by a native Android alarm + broadcast receiver, so a reminder still lands in the To Do list on time even if the app process isn't running.
- **Custom date & time picker** — a full month calendar (with month/year quick-jump) plus a 24-hour, 1-minute-precision time picker.
- **Animated splash screen** on launch.

## Tech stack

- [Expo](https://expo.dev) SDK 54 / React Native 0.81 / TypeScript
- `@react-native-async-storage/async-storage` for local persistence
- `expo-notifications` for notification channels and scheduling
- A small custom native Android module (Kotlin) — a foreground service for the persistent To Do notification, and a broadcast receiver + `AlarmManager` for reminders that must fire independent of the JS process
- `expo-splash-screen` for the animated launch screen

## Getting started

```bash
npm install
```

This project includes custom native Android code, so it cannot run inside Expo Go. Use a development build instead:

```bash
npx expo run:android
```

Or build with EAS:

```bash
eas build --platform android --profile preview
```

## Project structure

```
App.tsx                     Root screen, tabs, and layout
components/                 UI: reminder cards, add-reminder modal, animated splash
hooks/useReminders.ts        Reminder state, persistence, and scheduling logic
utils/notifications.ts       expo-notifications setup + bridge to native module
android/app/src/main/java/com/pinmind/app/
  ReminderModule.kt           Native module bridge (JS <-> Android)
  ReminderForegroundService.kt Persistent "To Do" notification service
  ReminderAlarmReceiver.kt     Fires reminders via AlarmManager, works app-killed
```

## Author

Designed and implemented by **Krishna Mahajan**

Contact: krishnamahajan2001@gmail.com

## License

MIT — see [LICENSE](LICENSE).
