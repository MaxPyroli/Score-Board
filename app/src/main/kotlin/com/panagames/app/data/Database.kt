package com.panagames.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Upsert

@Entity(tableName = "matches")
data class MatchEntity(
    @PrimaryKey val id: String,
    val moduleId: String,
    val playersJson: String,
    val roundsJson: String,
    val settingsJson: String,
    val createdAt: Long,
    val updatedAt: Long,
)

@Dao
interface MatchDao {
    @Query("SELECT * FROM matches ORDER BY updatedAt DESC")
    suspend fun getAll(): List<MatchEntity>

    @Upsert
    suspend fun upsert(entity: MatchEntity)

    @Query("DELETE FROM matches WHERE id = :id")
    suspend fun delete(id: String)
}

@Database(entities = [MatchEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun matchDao(): MatchDao

    companion object {
        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "panagames.db").build()
    }
}
