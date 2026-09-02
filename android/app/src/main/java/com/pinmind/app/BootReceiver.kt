package com.pinmind.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Brings the pinned reminders and the minute heartbeat back after a reboot or an
 * app update, both of which wipe every pending alarm and stop the service.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val intentAction = intent?.action ?: return
        if (intentAction != Intent.ACTION_BOOT_COMPLETED &&
            intentAction != Intent.ACTION_MY_PACKAGE_REPLACED &&
            intentAction != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        val appContext = context.applicationContext
        if (!ReminderStore.hasWork(appContext) && !HabitStore.hasHabits(appContext)) return

        ReminderStore.promoteDue(appContext)
        TasksNotifier.refresh(appContext)
        ReminderHeartbeat.schedule(appContext, 5_000L)

        if (ReminderStore.readActive(appContext).length() == 0) return

        val serviceIntent = Intent(appContext, ReminderForegroundService::class.java).apply {
            action = ReminderForegroundService.ACTION_REFRESH
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(serviceIntent)
            } else {
                appContext.startService(serviceIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
