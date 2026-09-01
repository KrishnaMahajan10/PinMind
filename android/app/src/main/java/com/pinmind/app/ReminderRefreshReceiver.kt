package com.pinmind.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * The one-minute tick.
 *
 * On every fire it re-reads the whole persisted reminder picture, promotes any
 * scheduled reminder that has come due, re-posts the pinned "To Do" notification
 * with the complete current list, and arms the next tick. This runs whether or
 * not the JS app is alive, so nothing is missed between app launches.
 */
class ReminderRefreshReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TICK = "com.pinmind.app.ACTION_REMINDER_TICK"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val appContext = context.applicationContext

        // Sweep anything that became due since the last tick into the active list.
        ReminderStore.promoteDue(appContext)

        if (!ReminderStore.hasWork(appContext)) {
            // Nothing left to show or wait for — stop burning alarms until JS adds something.
            ReminderHeartbeat.cancel(appContext)
            return
        }

        // Keep the chain going before doing anything that could throw.
        ReminderHeartbeat.schedule(appContext)

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
            // Background start can be refused in rare states; the next tick retries.
            e.printStackTrace()
        }
    }
}
