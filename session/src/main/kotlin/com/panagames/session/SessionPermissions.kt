package com.panagames.session

/** Permissions Android nécessaires à Nearby Connections, selon la version du système. */
object SessionPermissions {
    private const val BLUETOOTH_ADVERTISE = "android.permission.BLUETOOTH_ADVERTISE"
    private const val BLUETOOTH_CONNECT = "android.permission.BLUETOOTH_CONNECT"
    private const val BLUETOOTH_SCAN = "android.permission.BLUETOOTH_SCAN"
    private const val NEARBY_WIFI_DEVICES = "android.permission.NEARBY_WIFI_DEVICES"
    private const val ACCESS_FINE_LOCATION = "android.permission.ACCESS_FINE_LOCATION"

    fun required(sdkInt: Int): List<String> = when {
        sdkInt >= 33 -> listOf(BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, NEARBY_WIFI_DEVICES)
        sdkInt >= 31 -> listOf(BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION)
        else -> listOf(ACCESS_FINE_LOCATION)
    }
}
