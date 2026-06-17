export interface Song {
  id: string
  title: string
  artist: string
  album: string
  albumArt?: string
  duration: number
  filePath: string
  fileName: string
  fileSize: number
  format: string
  bitrate?: number
  sampleRate?: number
  genre?: string[]
  year?: number
  trackNumber?: number
  discNumber?: number
  lyrics?: string
  comments?: string
  addedAt: number
  lastPlayedAt?: number
  playCount: number
  rating: number
  fileHandle?: any
}

export interface LyricLine {
  time: number
  text: string
  translation?: string
  romanji?: string
}

export interface LyricsData {
  lines: LyricLine[]
  source: 'local' | 'online' | 'none'
}

export type PlayMode = 'sequential' | 'single' | 'repeat' | 'shuffle'

export type ThemeMode = 'light' | 'dark' | 'cyber' | 'retro' | 'minimal'

export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: string
}

export interface EQBand {
  frequency: number
  gain: number
  Q?: number
}

export interface EQPreset {
  name: string
  bands: number[]
}

export type EffectType = 'reverb' | 'compressor' | 'limiter' | 'stereo' | 'expander'

export interface EffectConfig {
  type: EffectType
  enabled: boolean
  order: number
  params: Record<string, number>
}

export type VisualizerType = 'spectrum' | 'waveform' | 'circular' | 'flame' | 'particles' | 'starfield'

export interface VisualizerConfig {
  type: VisualizerType
  beatSync: boolean
  mouseInteraction: boolean
  sensitivity: number
}

export interface SmartPlaylist {
  id: string
  name: string
  type: 'recentlyAdded' | 'recentlyPlayed' | 'mostPlayed' | 'topRated'
  count: number
}

export interface PlayQueue {
  songs: Song[]
  currentIndex: number
}

export interface SearchResult {
  songs: Song[]
  artists: string[]
  albums: string[]
}

export interface StatisticsData {
  totalSongs: number
  totalDuration: number
  totalPlayCount: number
  topArtists: { artist: string; playCount: number; duration: number }[]
  topSongs: Song[]
  playHistory: { date: string; count: number; duration: number }[]
}

export interface DuplicateCandidate {
  song: Song
  duplicates: Song[]
  similarity: number
}
