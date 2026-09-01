package com.pinmind.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Single source of truth for the reminder lists on the native side.
 *
 * Both lists are mirrored here from JS so that the alarm receivers and the
 * foreground service can rebuild the pinned "To Do" notification from the full,
 * current picture even when the JS process is dead.
 *
 *  - active:    [{ id, text, createdAt }]              → pinned in the notification bar
 *  - scheduled: [{ id, text, createdAt, remindAt }]    → waiting for their due time
 */
object ReminderStore {

    private const val PREFS = "pinmind_prefs"
    private const val KEY_ACTIVE = "last_reminders"
    private const val KEY_SCHEDULED = "scheduled_reminders"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun parse(json: String?): JSONArray =
        try {
            JSONArray(json ?: "[]")
        } catch (e: Exception) {
            JSONArray()
        }

    fun readActiveJson(context: Context): String =
        prefs(context).getString(KEY_ACTIVE, "[]") ?: "[]"

    fun readActive(context: Context): JSONArray = parse(readActiveJson(context))

    fun writeActive(context: Context, json: String) {
        prefs(context).edit().putString(KEY_ACTIVE, parse(json).toString()).apply()
    }

    fun readScheduled(context: Context): JSONArray =
        parse(prefs(context).getString(KEY_SCHEDULED, "[]"))

    fun writeScheduled(context: Context, json: String) {
        prefs(context).edit().putString(KEY_SCHEDULED, parse(json).toString()).apply()
    }

    fun clear(context: Context) {
        prefs(context).edit().putString(KEY_ACTIVE, "[]").apply()
    }

    private fun contains(array: JSONArray, id: String): Boolean {
        for (i in 0 until array.length()) {
            if (array.optJSONObject(i)?.optString("id") == id) return true
        }
        return false
    }

    /**
     * Move every scheduled reminder whose time has passed into the active list.
     *
     * Runs on every notification refresh, so a scheduled reminder still lands in
     * the "To Do" list within a minute even if its own exact alarm was dropped by
     * the OS or missed while the device was asleep.
     *
     * Returns true when something changed.
     */
    fun promoteDue(context: Context, now: Long = System.currentTimeMillis()): Boolean {
        val scheduled = readScheduled(context)
        if (scheduled.length() == 0) return false

        val active = readActive(context)
        val stillScheduled = JSONArray()
        val promoted = JSONArray()

        for (i in 0 until scheduled.length()) {
            val item = scheduled.optJSONObject(i) ?: continue
            if (item.optLong("remindAt", Long.MAX_VALUE) <= now) {
                if (!contains(active, item.optString("id"))) promoted.put(item)
            } else {
                stillScheduled.put(item)
            }
        }

        if (promoted.length() == 0 && stillScheduled.length() == scheduled.length()) return false

        val merged = JSONArray()
        for (i in 0 until promoted.length()) merged.put(promoted.get(i))
        for (i in 0 until active.length()) merged.put(active.get(i))

        prefs(context).edit()
            .putString(KEY_ACTIVE, merged.toString())
            .putString(KEY_SCHEDULED, stillScheduled.toString())
            .apply()

        return true
    }

    /** Add a single reminder to the front of the active list, ignoring duplicates. */
    fun addActive(context: Context, id: String, text: String) {
        val active = readActive(context)
        if (contains(active, id)) return

        val merged = JSONArray()
        merged.put(JSONObject().apply {
            put("id", id)
            put("text", text)
            put("createdAt", System.currentTimeMillis())
        })
        for (i in 0 until active.length()) merged.put(active.get(i))

        prefs(context).edit().putString(KEY_ACTIVE, merged.toString()).apply()
    }

    /** Drop a reminder from the scheduled list once it has been promoted or cancelled. */
    fun removeScheduled(context: Context, id: String) {
        val scheduled = readScheduled(context)
        val remaining = JSONArray()
        for (i in 0 until scheduled.length()) {
            val item = scheduled.optJSONObject(i) ?: continue
            if (item.optString("id") != id) remaining.put(item)
        }
        prefs(context).edit().putString(KEY_SCHEDULED, remaining.toString()).apply()
    }

    /** True when there is anything at all left to keep the minute heartbeat alive for. */
    fun hasWork(context: Context): Boolean =
        readActive(context).length() > 0 || readScheduled(context).length() > 0
}
