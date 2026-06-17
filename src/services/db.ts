import { openDB, IDBPDatabase, DBSchema } from 'idb'
import type { Song, StatisticsData } from '../types'
import { generateId } from '../utils'

interface MusicDB extends DBSchema {
  songs: {
    key: string
    value: Song
    indexes: {
      'by-title': string
      'by-artist': string
      'by-album': string
      'by-addedAt': number
      'by-playCount': number
      'by-rating': number
    }
  }
  settings: {
    key: string
    value: any
  }
  lyrics: {
    key: string
    value: { songId: string; lyrics: string; source: string; timestamp: number }
  }
  playHistory: {
    key: string
    value: { id: string; songId: string; timestamp: number; duration: number }
    indexes: {
      'by-timestamp': number
    }
  }
}

const DB_NAME = 'music-player-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<MusicDB>> | null = null

export function initDB(): Promise<IDBPDatabase<MusicDB>> {
  if (dbPromise) return dbPromise

  dbPromise = openDB<MusicDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const songsStore = db.createObjectStore('songs', { keyPath: 'id' })
      songsStore.createIndex('by-title', 'title')
      songsStore.createIndex('by-artist', 'artist')
      songsStore.createIndex('by-album', 'album')
      songsStore.createIndex('by-addedAt', 'addedAt')
      songsStore.createIndex('by-playCount', 'playCount')
      songsStore.createIndex('by-rating', 'rating')

      db.createObjectStore('settings', { keyPath: 'key' })

      db.createObjectStore('lyrics', { keyPath: 'songId' })

      const historyStore = db.createObjectStore('playHistory', { keyPath: 'id' })
      historyStore.createIndex('by-timestamp', 'timestamp')
    }
  })

  return dbPromise
}

export async function addSong(song: Omit<Song, 'id' | 'addedAt' | 'playCount' | 'rating'> & { id?: string }): Promise<Song> {
  const db = await initDB()
  const fullSong: Song = {
    id: song.id || generateId(),
    title: song.title,
    artist: song.artist,
    album: song.album,
    albumArt: song.albumArt,
    duration: song.duration,
    filePath: song.filePath,
    fileName: song.fileName,
    fileSize: song.fileSize,
    format: song.format,
    bitrate: song.bitrate,
    sampleRate: song.sampleRate,
    genre: song.genre,
    year: song.year,
    trackNumber: song.trackNumber,
    discNumber: song.discNumber,
    lyrics: song.lyrics,
    comments: song.comments,
    addedAt: Date.now(),
    playCount: 0,
    rating: 0
  }
  await db.add('songs', fullSong)
  return fullSong
}

export async function addSongs(songs: Omit<Song, 'id' | 'addedAt' | 'playCount' | 'rating'>[]): Promise<Song[]> {
  const db = await initDB()
  const tx = db.transaction('songs', 'readwrite')
  const results: Song[] = []
  for (const song of songs) {
    const fullSong: Song = {
      id: generateId(),
      ...song,
      addedAt: Date.now(),
      playCount: 0,
      rating: 0
    }
    await tx.store.add(fullSong)
    results.push(fullSong)
  }
  await tx.done
  return results
}

export async function updateSong(song: Song): Promise<void> {
  const db = await initDB()
  await db.put('songs', song)
}

export async function deleteSong(id: string): Promise<void> {
  const db = await initDB()
  await db.delete('songs', id)
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await initDB()
  return db.get('songs', id)
}

export async function getAllSongs(): Promise<Song[]> {
  const db = await initDB()
  return db.getAll('songs')
}

export async function getSongsByArtist(artist: string): Promise<Song[]> {
  const db = await initDB()
  return db.getAllFromIndex('songs', 'by-artist', artist)
}

export async function getSongsByAlbum(album: string): Promise<Song[]> {
  const db = await initDB()
  return db.getAllFromIndex('songs', 'by-album', album)
}

export async function getRecentlyAdded(count: number = 50): Promise<Song[]> {
  const db = await initDB()
  const songs = await db.getAllFromIndex('songs', 'by-addedAt')
  return songs.sort((a, b) => b.addedAt - a.addedAt).slice(0, count)
}

export async function getMostPlayed(count: number = 50): Promise<Song[]> {
  const db = await initDB()
  const songs = await db.getAllFromIndex('songs', 'by-playCount')
  return songs.sort((a, b) => b.playCount - a.playCount).slice(0, count)
}

export async function getTopRated(count: number = 50): Promise<Song[]> {
  const db = await initDB()
  const songs = await db.getAllFromIndex('songs', 'by-rating')
  return songs.sort((a, b) => b.rating - a.rating).slice(0, count)
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await initDB()
  await db.put('settings', { key, value })
}

export async function getSetting(key: string, defaultValue?: any): Promise<any> {
  const db = await initDB()
  const result = await db.get('settings', key)
  return result ? result.value : defaultValue
}

export async function recordPlay(songId: string, duration: number): Promise<void> {
  const db = await initDB()
  const song = await db.get('songs', songId)
  if (song) {
    song.playCount++
    song.lastPlayedAt = Date.now()
    await db.put('songs', song)
  }
  const id = generateId()
  await db.add('playHistory', { id, songId, timestamp: Date.now(), duration })
}

export async function saveLyrics(songId: string, lyrics: string, source: string): Promise<void> {
  const db = await initDB()
  await db.put('lyrics', { songId, lyrics, source, timestamp: Date.now() })
}

export async function getLyrics(songId: string): Promise<{ songId: string; lyrics: string; source: string; timestamp: number } | undefined> {
  const db = await initDB()
  return db.get('lyrics', songId)
}

export async function searchSongs(query: string): Promise<Song[]> {
  const db = await initDB()
  const songs = await db.getAll('songs')
  const lowerQuery = query.toLowerCase()
  return songs.filter(song =>
    song.title.toLowerCase().includes(lowerQuery) ||
    song.artist.toLowerCase().includes(lowerQuery) ||
    song.album.toLowerCase().includes(lowerQuery) ||
    (song.lyrics && song.lyrics.toLowerCase().includes(lowerQuery))
  )
}

export async function getStatistics(startDate?: number, endDate?: number): Promise<StatisticsData> {
  const db = await initDB()
  const songs = await db.getAll('songs')

  const totalSongs = songs.length
  const totalDuration = songs.reduce((sum, s) => sum + s.duration, 0)
  const totalPlayCount = songs.reduce((sum, s) => sum + s.playCount, 0)

  const artistStats: Record<string, { playCount: number; duration: number }> = {}
  for (const song of songs) {
    if (!artistStats[song.artist]) {
      artistStats[song.artist] = { playCount: 0, duration: 0 }
    }
    artistStats[song.artist].playCount += song.playCount
    artistStats[song.artist].duration += song.duration * song.playCount
  }

  const topArtists = Object.entries(artistStats)
    .map(([artist, stats]) => ({ artist, ...stats }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 20)

  const topSongs = [...songs]
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 20)

  return {
    totalSongs,
    totalDuration,
    totalPlayCount,
    topArtists,
    topSongs,
    playHistory: []
  }
}

export async function clearAllSongs(): Promise<void> {
  const db = await initDB()
  await db.clear('songs')
}
