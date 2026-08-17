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
    }

    @ReactMethod
    fun stopForegroundService() {
        val intent = Intent(reactContext, ReminderForegroundService::class.java).apply {
            action = ReminderForegroundService.ACTION_STOP
        }
        reactContext.stopService(intent)
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
    }

    @ReactMethod
    fun getForegroundReminders(promise: Promise) {
        val json = reactContext
            .getSharedPreferences("pinmind_prefs", Context.MODE_PRIVATE)
            .getString("last_reminders", "[]") ?: "[]"
        promise.resolve(json)
    }
}
