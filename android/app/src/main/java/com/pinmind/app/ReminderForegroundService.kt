package com.pinmind.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray

class ReminderForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "pinmind_foreground_channel"
        const val NOTIFICATION_ID = 1001
        const val EXTRA_REMINDERS = "extra_reminders"
        const val ACTION_UPDATE = "action_update"
        const val ACTION_REFRESH = "action_refresh"
        const val ACTION_STOP = "action_stop"
    }

    private var isStarted = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Only an explicit ACTION_STOP call should stop the service.
        // intent == null means Android restarted us after a process kill via START_STICKY —
        // in that case we restore from the store and keep running.
        if (intent?.action == ACTION_STOP) {
            ReminderStore.clear(this)
            ReminderHeartbeat.cancel(this)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            isStarted = false
            return START_NOT_STICKY
        }

        // A push from JS carries the authoritative active list. Every other entry
        // point — the minute tick, a boot, a START_STICKY restart — rebuilds from
        // whatever is already stored.
        if (intent?.action == ACTION_UPDATE) {
            intent.getStringExtra(EXTRA_REMINDERS)?.let { ReminderStore.writeActive(this, it) }
        }

        // Whatever woke us, re-check the whole picture before drawing: anything that
        // fell due since the last pass gets merged into the list first, so a refresh
        // never shows a stale or partial set of reminders.
        ReminderStore.promoteDue(this)
        TasksNotifier.refresh(this)

        val reminderList = parseReminders(ReminderStore.readActiveJson(this))

        if (reminderList.isEmpty()) {
            // Keep ticking while scheduled reminders — or habits — are still waiting.
            if (ReminderStore.hasWork(this) || HabitStore.hasHabits(this)) {
                ReminderHeartbeat.schedule(this)
            } else {
                ReminderHeartbeat.cancel(this)
            }
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            isStarted = false
            return START_NOT_STICKY
        }

        val notification = buildNotification(reminderList)

        if (!isStarted) {
            startForeground(NOTIFICATION_ID, notification)
            isStarted = true
        } else {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIFICATION_ID, notification)
        }

        // Keep the minute heartbeat armed for as long as anything is pinned.
        ReminderHeartbeat.schedule(this)

        return START_STICKY
    }

    private fun parseReminders(jsonStr: String): List<String> {
        val list = mutableListOf<String>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.opt(i)
                if (item is org.json.JSONObject) {
                    val text = item.optString("text", "")
                    if (text.isNotBlank()) list.add(text)
                } else if (item is String && item.isNotBlank()) {
                    list.add(item)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    private fun buildNotification(reminders: List<String>): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (reminders.size == 1) "To Do" else "To Do (${reminders.size})"
        val collapsedSummary = if (reminders.size == 1) reminders[0] else reminders.joinToString(" • ")
        val expandedFullText = reminders.joinToString("\n\n") { "• $it" }

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .bigText(expandedFullText)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(collapsedSummary)
            .setStyle(bigTextStyle)
            .setSmallIcon(R.drawable.notification_icon)
            .setColor(ContextCompat.getColor(this, R.color.notification_icon_color))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            // Re-stamping the time on every minute tick keeps the pin sorted to the
            // top of the shade instead of drifting down as other apps post.
            .setWhen(System.currentTimeMillis())
            .setShowWhen(false)
            .setOnlyAlertOnce(true)

        val notification = builder.build()
        // FLAG_ONGOING_EVENT: pins the notification at the top
        // FLAG_NO_CLEAR: prevents swipe-to-dismiss
        notification.flags = notification.flags or
            Notification.FLAG_ONGOING_EVENT or
            Notification.FLAG_NO_CLEAR

        return notification
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pinned Reminders",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Always-visible notes pinned in the notification bar."
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                // Silent — no sound or vibration on pin
                val silentAudioAttr = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                setSound(null, silentAudioAttr)
                enableVibration(false)
                setBypassDnd(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Called when the user swipes the app away from Recents.
     * We restart the foreground service immediately from the stored reminders
     * so the pinned notification never disappears.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        if (!ReminderStore.hasWork(this) && !HabitStore.hasHabits(this)) return

        ReminderHeartbeat.schedule(this, 5_000L)

        if (ReminderStore.readActive(this).length() == 0) return

        val restartIntent = Intent(this, ReminderForegroundService::class.java).apply {
            action = ACTION_REFRESH
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartIntent)
        } else {
            startService(restartIntent)
        }
    }
}
