package com.panagames.core

import kotlin.math.abs
import kotlin.math.roundToLong

object ScoreFormat {
    /** "56", "56,5" — virgule décimale, sans zéro inutile. */
    fun plain(value: Double): String {
        val rounded = (value * 10).roundToLong() / 10.0
        return if (rounded == rounded.toLong().toDouble()) rounded.toLong().toString()
        else rounded.toString().replace('.', ',')
    }

    /** "+60", "−31" (vrai signe moins), "0". */
    fun signed(value: Double): String {
        val body = plain(abs(value))
        return when {
            body == "0" -> "0"
            value > 0 -> "+$body"
            else -> "−$body"
        }
    }
}
