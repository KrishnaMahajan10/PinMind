package com.pinmind.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Fires exactly when a "Remind Me" alarm is due, even if the app process is killed.
 * Merges the reminder straight into the persisted native "To Do" list and refreshes
 * the foreground service notification, without waiting for the JS app to reopen.
 *
 * If this alarm is ever dropped by the OS, the minute heartbeat picks the reminder
 * up on its next pass instead.
 */
class ReminderAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_ID = "extra_id"
        const val EXTRA_TEXT = "extra_text"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val text = intent.getStringExtra(EXTRA_TEXT) ?: ""
        val appContext = context.applicationContext

        ReminderStore.addActive(appContext, id, text)
        ReminderStore.removeScheduled(appContext, id)
        ReminderHeartbeat.schedule(appContext)

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
