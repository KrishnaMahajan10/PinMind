package com.pinmind.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Arms the one-minute alarm that re-posts the pinned "To Do" notification.
 *
 * AlarmManager.setRepeating is inexact and gets stretched to many minutes under
 * Doze, so instead each tick re-arms the next one with an exact alarm.
 */
object ReminderHeartbeat {

    const val INTERVAL_MS = 60_000L
    private const val REQUEST_CODE = 90210

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, ReminderRefreshReceiver::class.java).apply {
            action = ReminderRefreshReceiver.ACTION_TICK
        }
        return PendingIntent.getBroadcast(
            context.applicationContext,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** Schedule the next tick one minute out. Safe to call repeatedly — it replaces the pending one. */
    fun schedule(context: Context, delayMs: Long = INTERVAL_MS) {
        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = System.currentTimeMillis() + delayMs
        val pi = pendingIntent(context)

        val canScheduleExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            alarmManager.canScheduleExactAlarms()

        if (canScheduleExact) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    fun cancel(context: Context) {
        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent(context))
    }
}
