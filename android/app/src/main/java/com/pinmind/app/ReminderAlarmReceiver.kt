package com.pinmind.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fires exactly when a "Remind Me" alarm is due, even if the app process is killed.
 * Merges the reminder straight into the persisted native "To Do" list and refreshes
 * the foreground service notification, without waiting for the JS app to reopen.
 */
class ReminderAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_ID = "extra_id"
        const val EXTRA_TEXT = "extra_text"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val text = intent.getStringExtra(EXTRA_TEXT) ?: ""

        val prefs = context.getSharedPreferences("pinmind_prefs", Context.MODE_PRIVATE)
        val existingJson = prefs.getString("last_reminders", "[]") ?: "[]"
        val array = try {
            JSONArray(existingJson)
        } catch (e: Exception) {
            JSONArray()
        }

        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i)
            if (item != null && item.optString("id") == id) return
        }

        val newItem = JSONObject().apply {
            put("id", id)
            put("text", text)
            put("createdAt", System.currentTimeMillis())
        }

        val updated = JSONArray()
        updated.put(newItem)
        for (i in 0 until array.length()) updated.put(array.get(i))
        val updatedJson = updated.toString()

        prefs.edit().putString("last_reminders", updatedJson).apply()

        val serviceIntent = Intent(context, ReminderForegroundService::class.java).apply {
            action = ReminderForegroundService.ACTION_UPDATE
            putExtra(ReminderForegroundService.EXTRA_REMINDERS, updatedJson)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
