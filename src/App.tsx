import { useEffect, useState, useRef, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { PlayerControls } from './components/PlayerControls'
import { Playlist } from './components/Playlist'
import { Visualizer } from './components/Visualizer'
import { EqualizerPanel } from './components/EqualizerPanel'
import { LyricsDisplay } from './components/LyricsDisplay'
import { SettingsPanel } from './components/SettingsPanel'
import { StatisticsView } from './components/StatisticsView'
import { SearchBar } from './components/SearchBar'
import { MetadataViewer } from './components/MetadataViewer'
import { usePlayerStore } from './store/playerStore'
import { getAudioEngine } from './services/audioEngine'
import {
  initDB, getAllSongs, addSongs, deleteSong,
  getRecentlyAdded, getMostPlayed, getStatistics, recordPlay,
  getSetting, setSetting
} from './services/db'
import {
  requestDirectoryPermission, scanDirectoryWithFiles, setupWebkitDirectoryInput,
  handleFiles, supportsFileSystemAccess, setupDragDrop,
  getSavedDirectoryHandle, getFileFromHandle
} from './services/fileSystem'
import { findDuplicates, calculateSimilarity } from './services/metadata'
import { getSongLyrics } from './services/lyrics'
import { setupMediaSession, updateMediaSession, registerMediaSessionHandlers } from './services/mediaSession'
import { applyTheme, loadSavedTheme, saveTheme } from './services/theme'
import { setupKeyboardShortcuts } from './services/shortcuts'
import { fileCache } from './services/fileCache'
import type { Song, PlayMode, LyricsData, StatisticsData, DuplicateCandidate } from './types'
import type { VisualizerType, ThemeConfig, EffectConfig } from './types'

function App() {
  const {
    songs, setSongs,
    currentSong, setCurrentSong,
    currentIndex, setCurrentIndex,
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration, setDuration,
    volume, setVolume,
    muted, setMuted,
    playMode, setPlayMode,
    queue,
    eqBands,
    autoEq, setAutoEq,
    effects, setEffects,
    visualizer, setVisualizer,
    theme, setTheme,
    isLoading, setIsLoading,
    searchQuery, setSearchQuery,
    currentView, setCurrentView,
    showEqualizer, setShowEqualizer,
    showVisualizer, setShowVisualizer,
    showLyrics, setShowLyrics,
    setEqBand,
    resetEq,
    applyEqPreset,
    toggleEffect,
    setEffectParam,
    addToQueue: storeAddToQueue
  } = usePlayerStore()

  const audioEngineRef = useRef<ReturnType<typeof getAudioEngine> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [selectedSongForMetadata, setSelectedSongForMetadata] = useState<Song | null>(null)
  const [stats, setStats] = useState<StatisticsData | null>(null)
  const [recentSongs, setRecentSongs] = useState<Song[]>([])
  const [topSongs, setTopSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all')
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const mainRef = useRef<HTMLDivElement>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (isInitialized.current) return
      isInitialized.current = true

      await initDB()

      const savedTheme = await loadSavedTheme()
      applyTheme(savedTheme)
      setTheme(savedTheme)

      const loadedSongs = await getAllSongs()
      setSongs(loadedSongs)
      setFilteredSongs(loadedSongs)

      if (loadedSongs.length > 0) {
        await loadSmartLists()
        const statistics = await getStatistics()
        setStats(statistics)
      }

      setupMediaSession()

      const engine = getAudioEngine()
      audioEngineRef.current = engine

      engine.setOnTimeUpdate((time: number) => {
        setCurrentTime(time)
      })

      engine.setOnEnded(() => {
        handleSongEnded()
      })

      engine.setOnLoadedMetadata((dur: number) => {
        setDuration(dur)
      })

      engine.setVolume(volume)
      engine.setMuted(muted)
      engine.setEqBands(eqBands, false)
      engine.setEffects(effects)

      registerMediaSessionHandlers({
        onPlay: () => handlePlayPause(),
        onPause: () => handlePlayPause(),
        onNext: () => handleNext(),
        onPrev: () => handlePrev(),
        onSeekForward: (s: number) => handleSeek(currentTime + s),
        onSeekBackward: (s: number) => handleSeek(Math.max(0, currentTime - s)),
        onSeekTo: (t: number) => handleSeek(t)
      })

      try {
        const savedDirHandle = await getSavedDirectoryHandle()
        if (savedDirHandle && loadedSongs.length > 0) {
          console.log('Restored directory handle, re-caching files...')
          const scanResult = await scanDirectoryWithFiles(savedDirHandle as any, {})
          
          for (const song of loadedSongs) {
            const file = scanResult.fileMap.get(song.filePath)
            const handle = scanResult.handleMap.get(song.filePath)
            if (file) {
              fileCache.setFile(song.id, file)
            }
            if (handle) {
              fileCache.setHandle(song.id, handle)
            }
          }
        }
      } catch (err) {
        console.warn('Failed to restore directory cache:', err)
      }
    }

    init()

    const cleanupShortcuts = setupKeyboardShortcuts({
      onPlayPause: () => handlePlayPause(),
      onNextTrack: () => handleNext(),
      onPrevTrack: () => handlePrev(),
      onSeekForward: (s: number) => handleSeek(currentTime + s),
      onSeekBackward: (s: number) => handleSeek(Math.max(0, currentTime - s)),
      onVolumeUp: () => setVolume(Math.min(1, volume + 0.05)),
      onVolumeDown: () => setVolume(Math.max(0, volume - 0.05)),
      onMute: () => setMuted(!muted),
      onToggleShuffle: () => setPlayMode(playMode === 'shuffle' ? 'sequential' : 'shuffle'),
      onToggleRepeat: () => {
        const modes: PlayMode[] = ['sequential', 'single', 'repeat']
        const idx = modes.indexOf(playMode as any)
        setPlayMode(modes[(idx + 1) % modes.length])
      },
      onSearch: () => setCurrentView('search'),
      onToggleEqualizer: () => setShowEqualizer(!showEqualizer),
      onToggleVisualizer: () => setShowVisualizer(!showVisualizer),
      onToggleLyrics: () => setShowLyrics(!showLyrics)
    })

    return () => {
      cleanupShortcuts()
    }
  }, [])

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(volume)
    }
  }, [volume])

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setMuted(muted)
    }
  }, [muted])

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setEqBands(eqBands, true)
    }
  }, [eqBands])

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setEffects(effects)
    }
  }, [effects])

  useEffect(() => {
    if (currentSong) {
      updateMediaSession(currentSong, isPlaying, currentTime, duration)
    }
  }, [currentSong, isPlaying, currentTime, duration])

  useEffect(() => {
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase()
      const filtered = songs.filter(s =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.artist.toLowerCase().includes(lowerQuery) ||
        s.album.toLowerCase().includes(lowerQuery) ||
        (s.lyrics && s.lyrics.toLowerCase().includes(lowerQuery))
      )
      setFilteredSongs(filtered)
    } else {
      setFilteredSongs(songs)
    }
  }, [searchQuery, songs])

  const refreshStats = async (period: 'week' | 'month' | 'year' | 'all') => {
    const now = Date.now()
    let startDate: number | undefined
    const endDate = now

    switch (period) {
      case 'week':
        startDate = now - 7 * 24 * 60 * 60 * 1000
        break
      case 'month':
        startDate = now - 30 * 24 * 60 * 60 * 1000
        break
      case 'year':
        startDate = now - 365 * 24 * 60 * 60 * 1000
        break
      case 'all':
      default:
        startDate = undefined
        break
    }

    const statistics = await getStatistics(startDate, endDate)
    setStats(statistics)
  }

  useEffect(() => {
    if (songs.length > 0) {
      refreshStats(statsPeriod)
    }
  }, [statsPeriod, songs.length])

  const loadSmartLists = async () => {
    const recent = await getRecentlyAdded(50)
    setRecentSongs(recent)
    const top = await getMostPlayed(50)
    setTopSongs(top)
  }

  const handleDroppedFiles = async (files: File[]) => {
    setIsLoading(true)
    try {
      const fileArray = files
      const newSongs = await handleFiles(fileArray, {
        onProgress: (current: number, total: number, fileName: string) => {
          console.log(`Processing ${current}/${total}: ${fileName}`)
        }
      })

      const existingSongs = songs
      const uniqueSongs: any[] = []
      const fileMap = new Map<string, File>()

      for (let i = 0; i < newSongs.length; i++) {
        const ns = newSongs[i] as any
        const isDuplicate = existingSongs.some(es => calculateSimilarity(es, ns) >= 0.85)
        if (!isDuplicate) {
          uniqueSongs.push(ns)
          if (fileArray[i]) {
            fileMap.set(ns.fileName + ns.fileSize, fileArray[i])
          }
        }
      }

      if (uniqueSongs.length > 0) {
        const addedSongs = await addSongs(uniqueSongs)

        for (let i = 0; i < addedSongs.length; i++) {
          const song = addedSongs[i]
          const originalFile = fileMap.get(song.fileName + song.fileSize)
          if (originalFile) {
            fileCache.setFile(song.id, originalFile)
          }
        }

        const allSongs = [...existingSongs, ...addedSongs]
        setSongs(allSongs)
        setFilteredSongs(allSongs)
        await loadSmartLists()
      }

      const dups = findDuplicates([...songs, ...newSongs] as any, 0.85)
      if (dups.length > 0) {
        setDuplicates(dups as any)
      }
    } catch (err) {
      console.error('Failed to add files:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddFolder = async () => {
    setIsLoading(true)
    try {
      if (supportsFileSystemAccess()) {
        const dirHandle = await requestDirectoryPermission()
        if (dirHandle) {
          const result = await scanDirectoryWithFiles(dirHandle as any, {
            onProgress: (current: number, total: number, fileName: string) => {
              console.log(`Scanning ${current}/${total}: ${fileName}`)
            }
          })

          const existingSongs = songs
          const uniqueSongs: any[] = []
          const uniqueFiles: { song: any; file: File; handle: any }[] = []

          for (const ns of result.songs) {
            const isDuplicate = existingSongs.some(es => calculateSimilarity(es, ns) >= 0.85)
            if (!isDuplicate) {
              uniqueSongs.push(ns)
              const file = result.fileMap.get(ns.filePath)
              const handle = result.handleMap.get(ns.filePath)
              if (file && handle) {
                uniqueFiles.push({ song: ns, file, handle })
              }
            }
          }

          if (uniqueSongs.length > 0) {
            const addedSongs = await addSongs(uniqueSongs as any)

            for (let i = 0; i < addedSongs.length; i++) {
              const matchingFile = uniqueFiles.find(
                f => f.song.fileName === addedSongs[i].fileName && f.song.fileSize === addedSongs[i].fileSize
              )
              if (matchingFile) {
                fileCache.setFile(addedSongs[i].id, matchingFile.file)
                fileCache.setHandle(addedSongs[i].id, matchingFile.handle)
              }
            }

            const allSongs = [...existingSongs, ...addedSongs]
            setSongs(allSongs)
            setFilteredSongs(allSongs)
            await loadSmartLists()
          }
        }
      } else {
        if (!folderInputRef.current) {
          folderInputRef.current = document.createElement('input')
        }
        const input = folderInputRef.current

        const newSongs = await setupWebkitDirectoryInput(input, {
          onProgress: (current: number, total: number, fileName: string) => {
            console.log(`Scanning ${current}/${total}: ${fileName}`)
          }
        })

        const existingSongs = songs
        const uniqueSongs: any[] = []

        for (const ns of newSongs) {
          const isDuplicate = existingSongs.some(es => calculateSimilarity(es, ns) >= 0.85)
          if (!isDuplicate) {
            uniqueSongs.push(ns)
          }
        }

        if (uniqueSongs.length > 0) {
          const addedSongs = await addSongs(uniqueSongs as any)
          const allSongs = [...existingSongs, ...addedSongs]
          setSongs(allSongs)
          setFilteredSongs(allSongs)
          await loadSmartLists()
        }
      }
    } catch (err) {
      console.error('Failed to add folder:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddFiles = () => {
    if (!fileInputRef.current) {
      fileInputRef.current = document.createElement('input')
    }
    const input = fileInputRef.current
    input.type = 'file'
    input.multiple = true
    input.accept = 'audio/*'
    input.onchange = async () => {
      if (input.files) {
        await handleDroppedFiles(Array.from(input.files))
      }
    }
    input.click()
  }

  const handlePlaySong = async (index: number) => {
    const songList = getCurrentSongList()
    const song = songList[index]
    if (!song || !audioEngineRef.current) return

    try {
      setIsLoading(true)

      let file = fileCache.getFile(song.id)
      if (!file) {
        const originalFile = await findOriginalFileForSong(song)
        if (originalFile) {
          file = originalFile
          fileCache.setFile(song.id, originalFile)
        }
      }

      if (!file) {
        console.warn('No file available for song:', song.title)
        alert('无法播放：文件引用已丢失。请重新添加该歌曲。')
        setIsLoading(false)
        return
      }

      setCurrentIndex(index)
      setCurrentSong(song)
      setDuration(song.duration)

      await audioEngineRef.current.loadSong(song as any, file)
      await audioEngineRef.current.play()

      setIsPlaying(true)
      setCurrentTime(0)

      try {
        await recordPlay(song.id, song.duration)
      } catch {}

      try {
        const lyricsData = await getSongLyrics(song.id, song.title, song.artist)
        setLyrics(lyricsData)
      } catch (err) {
        console.warn('Lyrics loading failed:', err)
      }

      if (autoEq) {
        applyAutoEQ(song as any)
      }
    } catch (err) {
      console.error('Failed to play song:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const findOriginalFileForSong = async (song: Song): Promise<File | null> => {
    try {
      const handle = fileCache.getHandle(song.id)
      if (handle && 'getFile' in handle) {
        return await (handle as any).getFile()
      }
    } catch {}
    return null
  }

  const handlePlayPause = useCallback(async () => {
    if (!audioEngineRef.current || !currentSong) return

    if (isPlaying) {
      audioEngineRef.current.pause()
      setIsPlaying(false)
    } else {
      try {
        await audioEngineRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        console.error('Play failed:', err)
      }
    }
  }, [isPlaying, currentSong])

  const handleNext = () => {
    if (queue.songs.length > 0) {
      return
    }

    if (playMode === 'single') {
      if (audioEngineRef.current) {
        audioEngineRef.current.seek(0)
        setCurrentTime(0)
      }
      return
    }

    const songList = songs
    let nextIndex: number

    if (playMode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * songList.length)
    } else {
      nextIndex = (currentIndex + 1) % songList.length
    }

    if (nextIndex >= 0 && nextIndex < songList.length) {
      handlePlaySong(nextIndex)
    }
  }

  const handlePrev = () => {
    if (currentTime > 3 && audioEngineRef.current) {
      audioEngineRef.current.seek(0)
      setCurrentTime(0)
      return
    }

    const songList = songs
    let prevIndex: number

    if (playMode === 'shuffle') {
      prevIndex = Math.floor(Math.random() * songList.length)
    } else {
      prevIndex = (currentIndex - 1 + songList.length) % songList.length
    }

    if (prevIndex >= 0 && prevIndex < songList.length) {
      handlePlaySong(prevIndex)
    }
  }

  const handleSeek = (time: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.seek(time)
      setCurrentTime(time)
    }
  }

  const handleSongEnded = () => {
    handleNext()
  }

  const handlePlayModeChange = (mode: PlayMode) => {
    setPlayMode(mode)
  }

  const applyAutoEQ = (song: Song) => {
    const genre = (song.genre?.[0] || '').toLowerCase()

    if (genre.includes('rock') || genre.includes('metal')) {
      applyEqPreset('rock')
    } else if (genre.includes('pop')) {
      applyEqPreset('pop')
    } else if (genre.includes('classical') || genre.includes('orchestral')) {
      applyEqPreset('classical')
    } else if (genre.includes('jazz')) {
      applyEqPreset('jazz')
    } else if (genre.includes('electronic') || genre.includes('techno') || genre.includes('house')) {
      applyEqPreset('electronic')
    } else if (genre.includes('acoustic') || genre.includes('folk')) {
      applyEqPreset('acoustic')
    } else if (genre.includes('vocal')) {
      applyEqPreset('vocal')
    }
  }

  const handleViewChange = (view: any) => {
    setCurrentView(view)
  }

  const handleThemeChange = async (newTheme: ThemeConfig) => {
    applyTheme(newTheme)
    setTheme(newTheme)
    await saveTheme(newTheme)
  }

  const handleRemoveSong = async (song: Song) => {
    await deleteSong(song.id)
    fileCache.removeSong(song.id)
    const newSongs = songs.filter(s => s.id !== song.id)
    setSongs(newSongs)
    setFilteredSongs(newSongs)

    if (currentSong?.id === song.id) {
      setCurrentSong(null)
      setCurrentIndex(-1)
      setIsPlaying(false)
      audioEngineRef.current?.stop()
    }
  }

  const getCurrentSongList = (): Song[] => {
    switch (currentView) {
      case 'search':
        return filteredSongs
      case 'recent':
        return recentSongs
      case 'top':
        return topSongs
      case 'queue':
        return queue.songs
      default:
        return songs
    }
  }

  const totalDuration = songs.reduce((sum, s) => sum + s.duration, 0)
  const audioCtx = audioEngineRef.current?.getAudioContext() || null
  const analyser = audioEngineRef.current?.getAnalyser() || null

  const renderMainContent = () => {
    switch (currentView) {
      case 'settings':
        return (
          <SettingsPanel
            theme={theme}
            visualizer={visualizer}
            onThemeChange={handleThemeChange}
            onVisualizerChange={setVisualizer}
          />
        )
      case 'statistics':
        return stats ? (
          <StatisticsView
            stats={stats}
            songs={songs}
            period={statsPeriod}
            onPeriodChange={setStatsPeriod}
          />
        ) : null
      default:
        return null
    }
  }

  const showPlaylistView = currentView === 'library' || currentView === 'search' || currentView === 'recent' || currentView === 'top' || currentView === 'queue'

  return (
    <div className="app" data-theme={theme.mode}>
      <Sidebar
        songs={songs}
        currentView={currentView}
        onViewChange={handleViewChange}
        onAddFolder={handleAddFolder}
        onAddFiles={handleAddFiles}
        totalSongs={songs.length}
        totalDuration={totalDuration}
      />

      <main className="main-content" ref={mainRef}>
        {currentView === 'search' && (
          <div className="search-header">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索歌曲、艺术家、专辑、歌词..."
            />
          </div>
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>正在加载...</p>
          </div>
        )}

        {showVisualizer && (
          <div className="visualizer-section">
            <Visualizer
              audioContext={audioCtx}
              analyser={analyser}
              type={visualizer.type as VisualizerType}
              beatSync={visualizer.beatSync}
              mouseInteraction={visualizer.mouseInteraction}
              sensitivity={visualizer.sensitivity}
              primaryColor={theme.primaryColor}
              isPlaying={isPlaying}
            />
          </div>
        )}

        {showLyrics && currentSong && (
          <div className="lyrics-section">
            <LyricsDisplay
              lyrics={lyrics}
              currentTime={currentTime}
              showTranslation={false}
              showRomanji={false}
            />
          </div>
        )}

        {showPlaylistView && (
          <Playlist
            songs={currentView === 'recent' ? recentSongs :
                   currentView === 'top' ? topSongs :
                   currentView === 'search' ? filteredSongs : songs}
            currentIndex={currentView === 'library' ? currentIndex : -1}
            isPlaying={isPlaying}
            currentView={currentView as any}
            onPlaySong={handlePlaySong}
            onAddToQueue={storeAddToQueue}
            onViewMetadata={setSelectedSongForMetadata}
            onRemoveSong={handleRemoveSong}
            searchQuery={searchQuery}
            queueSongs={queue.songs}
          />
        )}

        {!showPlaylistView && renderMainContent()}

        {showEqualizer && (
          <div className="equalizer-section">
            <EqualizerPanel
              eqBands={eqBands}
              eqPreset={'flat'}
              autoEq={autoEq}
              effects={effects}
              onEqBandChange={setEqBand}
              onPresetChange={applyEqPreset}
              onReset={resetEq}
              onAutoEqToggle={setAutoEq}
              onToggleEffect={toggleEffect}
              onEffectParamChange={setEffectParam}
            />
          </div>
        )}
      </main>

      <PlayerControls
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration || currentSong?.duration || 0}
        volume={volume}
        muted={muted}
        playMode={playMode}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={setVolume}
        onMuteToggle={() => setMuted(!muted)}
        onPlayModeChange={handlePlayModeChange}
        onShowEqualizer={() => setShowEqualizer(!showEqualizer)}
        onShowLyrics={() => setShowLyrics(!showLyrics)}
        onShowPlaylist={() => setCurrentView('library')}
      />

      {selectedSongForMetadata && (
        <MetadataViewer
          song={selectedSongForMetadata}
          onClose={() => setSelectedSongForMetadata(null)}
        />
      )}
    </div>
  )
}

export default App
