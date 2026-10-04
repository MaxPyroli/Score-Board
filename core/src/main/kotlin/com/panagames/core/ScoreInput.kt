package com.panagames.core

import kotlin.math.abs

/** Lecture d'un nombre saisi au clavier (virgule ou point décimal, signe optionnel). */
object ScoreInput {
    private val pattern = Regex("-?\\d+([.,]\\d+)?")

    /**
     * `null` si le texte n'est pas un nombre. [negative] force le signe moins
     * (bouton « − » de l'écran) ; un « - » tapé donne aussi un nombre négatif.
     */
    fun parse(text: String, negative: Boolean = false): Double? {
        val trimmed = text.trim()
        if (!pattern.matches(trimmed)) return null
        val value = trimmed.replace(',', '.').toDouble()
        return if (negative || trimmed.startsWith("-")) -abs(value) else value
    }
}
