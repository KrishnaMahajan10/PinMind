package com.pinmind.app

import android.content.Context
import java.util.Calendar
import java.util.Locale
import org.json.JSONArray

/**
 * Native mirror of the JS habit list plus a same-day cache of which habits
 * have already been ticked. This lets the minute heartbeat decide whether the
 * pinned "Tasks" notification should keep nagging even if the JS process is
 * dead — exactly like ReminderStore does for the "To Do" pin.
 *
 * The done-today cache is scoped to whatever date it was written on; once the
 * device rolls over to a new day it is treated as empty again without any
 * explicit reset, since a habit's real historical log lives in JS/AsyncStorage
 * — this cache only exists to suppress today's notification once ticked.
 */
object HabitStore {

    private const val PREFS = "pinmind_prefs"
    private const val KEY_HABITS = "habits_list"
    private const val KEY_DONE_DATE = "habits_done_date"
    private const val KEY_DONE_IDS = "habits_done_ids"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun todayKey(): String {
        val c = Calendar.getInstance()
        return String.format(
            Locale.US, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH)
        )
    }

    private fun parse(json: String?): JSONArray =
        try { JSONArray(json ?: "[]") } catch (e: Exception) { JSONArray() }

    fun writeHabits(context: Context, json: String) {
        prefs(context).edit().putString(KEY_HABITS, parse(json).toString()).apply()
    }

    fun readHabits(context: Context): JSONArray =
        parse(prefs(context).getString(KEY_HABITS, "[]"))

    fun hasHabits(context: Context): Boolean = readHabits(context).length() > 0

    /** JS always sends the full current set of habit ids ticked done today. */
    fun writeDoneToday(context: Context, idsJson: String) {
        prefs(context).edit()
            .putString(KEY_DONE_DATE, todayKey())
            .putString(KEY_DONE_IDS, parse(idsJson).toString())
            .apply()
    }

    private fun readDoneTodaySet(context: Context): Set<String> {
        val storedDate = prefs(context).getString(KEY_DONE_DATE, null)
        if (storedDate != todayKey()) return emptySet()

        val arr = parse(prefs(context).getString(KEY_DONE_IDS, "[]"))
        val set = mutableSetOf<String>()
        for (i in 0 until arr.length()) {
            arr.optString(i, null)?.let { set.add(it) }
        }
        return set
    }

    /**
     * Texts of habits scheduled for today, whose time has already passed,
     * and that haven't been ticked done today.
     */
    fun getDueUndoneTexts(context: Context): List<String> {
        val habits = readHabits(context)
        if (habits.length() == 0) return emptyList()

        val doneToday = readDoneTodaySet(context)
        val now = Calendar.getInstance()
        // Calendar.DAY_OF_WEEK: 1 = Sunday ... 7 = Saturday -> JS Date#getDay(): 0 = Sunday ... 6 = Saturday
        val jsWeekday = now.get(Calendar.DAY_OF_WEEK) - 1
        val nowHour = now.get(Calendar.HOUR_OF_DAY)
        val nowMinute = now.get(Calendar.MINUTE)

        val due = mutableListOf<String>()
        for (i in 0 until habits.length()) {
            val habit = habits.optJSONObject(i) ?: continue
            val id = habit.optString("id", "")
            if (id.isEmpty() || doneToday.contains(id)) continue

            val days = habit.optJSONArray("days") ?: continue
            var scheduledToday = false
            for (j in 0 until days.length()) {
                if (days.optInt(j, -1) == jsWeekday) {
                    scheduledToday = true
                    break
                }
            }
            if (!scheduledToday) continue

            val hour = habit.optInt("hour", 0)
            val minute = habit.optInt("minute", 0)
            val isDue = nowHour > hour || (nowHour == hour && nowMinute >= minute)
            if (isDue) {
                val text = habit.optString("text", "")
                if (text.isNotBlank()) due.add(text)
            }
        }
        return due
    }
}
