export const EQ_FREQUENCIES = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
]

export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, 2, 4, 4, 2, 0, -1, -1, -1, -1],
  rock: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  classical: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  electronic: [4, 3, 2, 0, -2, -2, 0, 2, 4, 5],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 2, 1, 0],
  acoustic: [3, 2, 1, 0, 1, 2, 3, 4, 3, 2]
}

export const PRESET_NAMES = [
  'flat', 'pop', 'rock', 'classical', 'jazz',
  'electronic', 'bass', 'treble', 'vocal', 'acoustic'
]

export const AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac',
  '.wma', '.opus', '.webm', '.oga', '.spx'
]

export const LRC_EXTENSIONS = ['.lrc', '.txt']

export const DEFAULT_THEME_COLOR = '#6366f1'

export const THEME_COLORS: Record<string, string> = {
  light: '#6366f1',
  dark: '#6366f1',
  cyber: '#00f5ff',
  retro: '#ff6b35',
  minimal: '#333333'
}
