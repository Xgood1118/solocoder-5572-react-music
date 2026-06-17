import { create } from 'zustand'
import type { Song, PlayMode, ThemeConfig, EQBand, EffectConfig, VisualizerConfig, PlayQueue } from '../types'
import { EQ_FREQUENCIES, EQ_PRESETS } from '../constants'

interface PlayerState {
  songs: Song[]
  currentSong: Song | null
  currentIndex: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playMode: PlayMode
  queue: PlayQueue
  shuffleOrder: number[]
  eqBands: number[]
  eqPreset: string
  autoEq: boolean
  effects: EffectConfig[]
  visualizer: VisualizerConfig
  theme: ThemeConfig
  isLoading: boolean
  searchQuery: string
  currentView: 'library' | 'search' | 'recent' | 'top' | 'queue' | 'settings' | 'statistics'
  showEqualizer: boolean
  showVisualizer: boolean
  showLyrics: boolean

  setSongs: (songs: Song[]) => void
  setCurrentSong: (song: Song | null) => void
  setCurrentIndex: (index: number) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlayMode: (mode: PlayMode) => void
  setQueue: (queue: PlayQueue) => void
  setEqBands: (bands: number[]) => void
  setEqPreset: (preset: string) => void
  setAutoEq: (auto: boolean) => void
  setEffects: (effects: EffectConfig[]) => void
  setVisualizer: (config: VisualizerConfig) => void
  setTheme: (theme: ThemeConfig) => void
  setIsLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setCurrentView: (view: PlayerState['currentView']) => void
  setShowEqualizer: (show: boolean) => void
  setShowVisualizer: (show: boolean) => void
  setShowLyrics: (show: boolean) => void

  playSong: (index: number) => void
  playNext: () => void
  playPrev: () => void
  togglePlay: () => void
  addToQueue: (song: Song) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  generateShuffleOrder: () => void
  setEqBand: (index: number, gain: number) => void
  resetEq: () => void
  applyEqPreset: (preset: string) => void
  toggleEffect: (type: string) => void
  setEffectParam: (type: string, param: string, value: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  songs: [],
  currentSong: null,
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  muted: false,
  playMode: 'sequential',
  queue: { songs: [], currentIndex: -1 },
  shuffleOrder: [],
  eqBands: new Array(10).fill(0),
  eqPreset: 'flat',
  autoEq: false,
  effects: [
    { type: 'reverb' as const, enabled: false, order: 0, params: { mix: 0.3, decay: 2, wet: 0.3 } as Record<string, number> },
    { type: 'compressor' as const, enabled: false, order: 1, params: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 } as Record<string, number> },
    { type: 'limiter' as const, enabled: false, order: 2, params: { threshold: -1, attack: 0.005, release: 0.1 } as Record<string, number> },
    { type: 'stereo' as const, enabled: false, order: 3, params: { width: 0.5 } as Record<string, number> },
    { type: 'expander' as const, enabled: false, order: 4, params: { threshold: -40, ratio: 2, attack: 0.01, release: 0.2 } as Record<string, number> }
  ],
  visualizer: {
    type: 'spectrum',
    beatSync: true,
    mouseInteraction: true,
    sensitivity: 0.7
  },
  theme: {
    mode: 'dark',
    primaryColor: '#6366f1'
  },
  isLoading: false,
  searchQuery: '',
  currentView: 'library',
  showEqualizer: false,
  showVisualizer: true,
  showLyrics: false,

  setSongs: (songs) => set({ songs }),
  setCurrentSong: (song) => set({ currentSong: song }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setPlayMode: (mode) => {
    set({ playMode: mode })
    if (mode === 'shuffle') {
      get().generateShuffleOrder()
    }
  },
  setQueue: (queue) => set({ queue }),
  setEqBands: (bands) => set({ eqBands: bands }),
  setEqPreset: (preset) => set({ eqPreset: preset }),
  setAutoEq: (auto) => set({ autoEq: auto }),
  setEffects: (effects) => set({ effects }),
  setVisualizer: (config) => set({ visualizer: config }),
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme.mode)
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor)
  },
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCurrentView: (view) => set({ currentView: view }),
  setShowEqualizer: (show) => set({ showEqualizer: show }),
  setShowVisualizer: (show) => set({ showVisualizer: show }),
  setShowLyrics: (show) => set({ showLyrics: show }),

  playSong: (index) => {
    const { songs } = get()
    if (index >= 0 && index < songs.length) {
      set({ currentIndex: index, currentSong: songs[index] })
    }
  },
  playNext: () => {
    const { songs, currentIndex, playMode, shuffleOrder } = get()
    if (songs.length === 0) return

    let nextIndex = currentIndex
    if (playMode === 'single') {
      return
    } else if (playMode === 'shuffle') {
      const currentShuffleIdx = shuffleOrder.indexOf(currentIndex)
      nextIndex = shuffleOrder[(currentShuffleIdx + 1) % shuffleOrder.length]
    } else {
      nextIndex = (currentIndex + 1) % songs.length
    }
    get().playSong(nextIndex)
  },
  playPrev: () => {
    const { songs, currentIndex, playMode, shuffleOrder } = get()
    if (songs.length === 0) return

    let prevIndex = currentIndex
    if (playMode === 'shuffle') {
      const currentShuffleIdx = shuffleOrder.indexOf(currentIndex)
      prevIndex = shuffleOrder[(currentShuffleIdx - 1 + shuffleOrder.length) % shuffleOrder.length]
    } else {
      prevIndex = (currentIndex - 1 + songs.length) % songs.length
    }
    get().playSong(prevIndex)
  },
  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  addToQueue: (song) => {
    const { queue } = get()
    set({
      queue: {
        ...queue,
        songs: [...queue.songs, song]
      }
    })
  },
  removeFromQueue: (index) => {
    const { queue } = get()
    const newSongs = queue.songs.filter((_, i) => i !== index)
    set({ queue: { ...queue, songs: newSongs } })
  },
  clearQueue: () => set({ queue: { songs: [], currentIndex: -1 } }),
  generateShuffleOrder: () => {
    const { songs } = get()
    const order = Array.from({ length: songs.length }, (_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    set({ shuffleOrder: order })
  },
  setEqBand: (index, gain) => {
    const { eqBands } = get()
    const newBands = [...eqBands]
    newBands[index] = gain
    set({ eqBands: newBands, eqPreset: 'custom' })
  },
  resetEq: () => {
    set({ eqBands: new Array(10).fill(0), eqPreset: 'flat' })
  },
  applyEqPreset: (preset) => {
    const presetBands = EQ_PRESETS[preset]
    if (presetBands) {
      set({ eqBands: [...presetBands], eqPreset: preset })
    }
  },
  toggleEffect: (type) => {
    const { effects } = get()
    set({
      effects: effects.map(e =>
        e.type === type ? { ...e, enabled: !e.enabled } : e
      )
    })
  },
  setEffectParam: (type, param, value) => {
    const { effects } = get()
    set({
      effects: effects.map(e =>
        e.type === type ? { ...e, params: { ...e.params, [param]: value } } : e
      )
    })
  }
}))
