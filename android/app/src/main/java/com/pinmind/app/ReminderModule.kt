package com.pinmind.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ReminderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ReminderModule"

    @ReactMethod
    fun updateForegroundReminders(remindersJson: String) {
        val intent = Intent(reactContext, ReminderForegroundService::class.java).apply {
            action = ReminderForegroundService.ACTION_UPDATE
            putExtra(ReminderForegroundService.EXTRA_REMINDERS, remindersJson)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
        ReminderHeartbeat.schedule(reactContext)
    }

    @ReactMethod
    fun stopForegroundService() {
        // Clear here rather than through ACTION_STOP: stopService does not deliver
        // the intent to onStartCommand, so the store would otherwise keep a stale
        // list and the next refresh would resurrect deleted reminders.
        ReminderStore.clear(reactContext)
        if (!hasAnyWork()) {
            ReminderHeartbeat.cancel(reactContext)
        }
        val intent = Intent(reactContext, ReminderForegroundService::class.java).apply {
            action = ReminderForegroundService.ACTION_STOP
        }
        reactContext.stopService(intent)
    }

    /**
     * Mirror the pending "Remind Me" list so the minute heartbeat can promote a
     * reminder that comes due while the JS process is dead — or whose own exact
     * alarm was dropped by the OS.
     */
    @ReactMethod
    fun setScheduledReminders(scheduledJson: String) {
        ReminderStore.writeScheduled(reactContext, scheduledJson)
        if (hasAnyWork()) {
            ReminderHeartbeat.schedule(reactContext)
        } else {
            ReminderHeartbeat.cancel(reactContext)
        }
    }

    /** Arm the minute refresh chain if there is anything to keep showing. */
    @ReactMethod
    fun startHeartbeat() {
        if (hasAnyWork()) {
            ReminderHeartbeat.schedule(reactContext)
        }
    }

    private fun hasAnyWork(): Boolean =
        ReminderStore.hasWork(reactContext) || HabitStore.hasHabits(reactContext)

    /**
     * Mirror the full habit list so the minute heartbeat can pin/refresh the
     * "Tasks" notification even while the JS process is dead — mirroring how
     * setScheduledReminders backs the "To Do" pin.
     */
    @ReactMethod
    fun setHabits(habitsJson: String) {
        HabitStore.writeHabits(reactContext, habitsJson)
        TasksNotifier.refresh(reactContext)
        if (hasAnyWork()) {
            ReminderHeartbeat.schedule(reactContext)
        } else {
            ReminderHeartbeat.cancel(reactContext)
        }
    }

    /** JS always sends the full current set of habit ids ticked done today. */
    @ReactMethod
    fun setHabitsDoneToday(doneIdsJson: String) {
        HabitStore.writeDoneToday(reactContext, doneIdsJson)
        TasksNotifier.refresh(reactContext)
    }

    private fun alarmPendingIntent(id: String): PendingIntent {
        val intent = Intent(reactContext, ReminderAlarmReceiver::class.java)
        return PendingIntent.getBroadcast(
            reactContext,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /**
     * Schedules a native OS alarm that merges this reminder into the persistent
     * "To Do" list the instant it fires, even if the app process is dead.
     */
    @ReactMethod
    fun scheduleNativeAlert(id: String, text: String, triggerAtMillis: Double) {
        val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(reactContext, ReminderAlarmReceiver::class.java).apply {
            putExtra(ReminderAlarmReceiver.EXTRA_ID, id)
            putExtra(ReminderAlarmReceiver.EXTRA_TEXT, text)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            reactContext,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val canScheduleExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            alarmManager.canScheduleExactAlarms()

        if (canScheduleExact) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis.toLong(),
                pendingIntent
            )
        } else {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis.toLong(),
                pendingIntent
            )
        }
    }

    @ReactMethod
    fun cancelNativeAlert(id: String) {
        val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(alarmPendingIntent(id))
        ReminderStore.removeScheduled(reactContext, id)
    }

    @ReactMethod
    fun getForegroundReminders(promise: Promise) {
        promise.resolve(ReminderStore.readActiveJson(reactContext))
    }
}
