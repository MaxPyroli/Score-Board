// Versions des plugins : voir settings.gradle.kts (pluginManagement).
// Déclarés ici sans être appliqués pour que le plugin Kotlin soit chargé une seule fois.
plugins {
    kotlin("jvm") apply false
    kotlin("plugin.serialization") apply false
}
