pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
    // Versions déclarées ici : elles ne sont résolues que si un module applique le plugin.
    plugins {
        kotlin("jvm") version "2.0.21"
        kotlin("android") version "2.0.21"
        kotlin("plugin.serialization") version "2.0.21"
        kotlin("plugin.compose") version "2.0.21"
        id("com.android.application") version "8.7.3"
        id("com.google.devtools.ksp") version "2.0.21-1.0.28"
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "panagames"

// Kotlin pur (aucune dépendance Android) : testable sur JVM et réutilisable (ex. version web).
include(":core")
include(":tarot-engine")

// Module Android : inclus seulement si un SDK Android est détecté
// (Android Studio, GitHub Actions…). Les modules Kotlin purs restent
// compilables et testables partout sans SDK.
val hasAndroidSdk = System.getenv("ANDROID_HOME") != null ||
    System.getenv("ANDROID_SDK_ROOT") != null ||
    File(rootDir, "local.properties").let { it.exists() && it.readText().contains("sdk.dir") }
if (hasAndroidSdk) {
    include(":app")
}
