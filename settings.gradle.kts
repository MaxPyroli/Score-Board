pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "panagames"

// Moteur de règles du Tarot : module Kotlin pur (aucune dépendance Android),
// pour rester testable sur JVM et réutilisable plus tard (ex. version web).
include(":tarot-engine")

// Le module "app" (Android + Jetpack Compose) sera ajouté à l'étape 2
// de l'ordre de travail (écrans de base), une fois le moteur de règles validé.
