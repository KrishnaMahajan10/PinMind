package com.pinmind.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Posts/refreshes the pinned "Tasks" notification for any recurring habit
 * that is scheduled for today, past its time, and not yet ticked — mirroring
 * how ReminderForegroundService pins "To Do", so this survives Doze and app
 * kills via the same minute heartbeat rather than a standalone alarm that
 * some OEMs silently drop.
 */
object TasksNotifier {

    const val CHANNEL_ID = "daily-tasks"
    private const val NOTIFICATION_ID = 1002

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(CHANNEL_ID, "Tasks", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Recurring daily task reminders at the time you choose."
            setShowBadge(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 150, 250)
            enableLights(true)
            lightColor = Color.parseColor("#8b5cf6")
        }
        manager.createNotificationChannel(channel)
    }

    fun refresh(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val due = HabitStore.getDueUndoneTexts(context)

        if (due.isEmpty()) {
            manager.cancel(NOTIFICATION_ID)
            return
        }

        ensureChannel(context)

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (due.size == 1) "Tasks" else "Tasks (${due.size})"
        val collapsedSummary = if (due.size == 1) due[0] else due.joinToString(" • ")
        val expandedFullText = due.joinToString("\n\n") { "• $it" }

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .bigText(expandedFullText)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(collapsedSummary)
            .setStyle(bigTextStyle)
            .setSmallIcon(R.drawable.notification_icon)
            .setColor(ContextCompat.getColor(context, R.color.notification_icon_color))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            // Re-stamping the time on every minute tick keeps the pin sorted to the
            // top of the shade instead of drifting down as other apps post.
            .setWhen(System.currentTimeMillis())
            .setShowWhen(false)
            // Alerts (sound/heads-up) only the first time a habit becomes due;
            // later heartbeat re-posts of the same due list stay silent.
            .setOnlyAlertOnce(true)

        val notification = builder.build()
        notification.flags = notification.flags or
            Notification.FLAG_ONGOING_EVENT or
            Notification.FLAG_NO_CLEAR

        manager.notify(NOTIFICATION_ID, notification)
    }
}
