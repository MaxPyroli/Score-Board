package com.panagames.session

import kotlin.random.Random

/**
 * Code court qui identifie une partie partagée (ex. « K7F2 »). Alphabet sans
 * caractères ambigus (pas de 0/O ni de 1/I) pour pouvoir le dicter ou le lire.
 */
object SessionCode {
    const val LENGTH = 4
    const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private const val QR_PREFIX = "PANAGAMES:"

    fun generate(random: Random = Random.Default): String =
        buildString { repeat(LENGTH) { append(ALPHABET[random.nextInt(ALPHABET.length)]) } }

    /** Code saisi à la main : majuscules, espaces et tirets ignorés. `null` s'il est invalide. */
    fun normalize(input: String): String? {
        val cleaned = input.uppercase().filter { it != ' ' && it != '-' }
        return cleaned.takeIf { it.length == LENGTH && it.all { c -> c in ALPHABET } }
    }

    fun toQrText(code: String): String = QR_PREFIX + code

    /** Code contenu dans un QR code scanné, ou `null` si ce n'est pas un QR PanaGames valide. */
    fun fromQrText(text: String): String? =
        if (text.startsWith(QR_PREFIX)) normalize(text.removePrefix(QR_PREFIX)) else null
}
