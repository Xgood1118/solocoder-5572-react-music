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
import { AudioEngine, getAudioEngine } from './services/audioEngine'
import { initDB, getAllSongs, addSongs, deleteSong, getRecentlyAdded, getMostPlayed, getStatistics, recordPlay } from './services/db'
import { requestDirectoryPermission, scanDirectory, setupWebkitDirectoryInput, handleFiles, supportsFileSystemAccess, setupDragDrop } from './services/fileSystem'
import { findDuplicates, calculateSimilarity } from './services/metadata'
import { getSongLyrics, fetchLyricsOnline } from './services/lyrics'
import { setupMediaSession, updateMediaSession, updateMediaSessionPlaybackState, registerMediaSessionHandlers } from './services/mediaSession'
import { applyTheme, loadSavedTheme, saveTheme } from './services/theme'
import { setupKeyboardShortcuts } from './services/shortcuts'
import type { Song, PlayMode, LyricsData, StatisticsData, DuplicateCandidate } from './types'
import type { VisualizerType } from './types'

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
    eqBands, setEqBands,
    eqPreset, setEqPreset,
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
    playSong: storePlaySong,
    playNext: storePlayNext,
    playPrev: storePlayPrev,
    togglePlay: storeTogglePlay,
    addToQueue: storeAddToQueue,
    setEqBand,
    resetEq,
    applyEqPreset,
    toggleEffect,
    setEffectParam
  } = usePlayerStore()

  const audioEngineRef = useRef<AudioEngine | null>(null)
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

  useEffect(() => {
    const init = async () => {
      await initDB()

      const savedTheme = await loadSavedTheme()
      applyTheme(savedTheme)
      setTheme(savedTheme)

      const loadedSongs = await getAllSongs()
      setSongs(loadedSongs)
      setFilteredSongs(loadedSongs)

      if (loadedSongs.length > 0) {
        const recent = await getRecentlyAdded(50)
        setRecentSongs(recent)
        const top = await getMostPlayed(50)
        setTopSongs(top)
        const statistics = await getStatistics()
        setStats(statistics)
      }

      setupMediaSession()

      const engine = getAudioEngine()
      audioEngineRef.current = engine

      engine.setOnTimeUpdate((time) => {
        setCurrentTime(time)
      })

      engine.setOnEnded(() => {
        handleSongEnded()
      })

      registerMediaSessionHandlers({
        onPlay: () => handlePlayPause(),
        onPause: () => handlePlayPause(),
        onNext: () => handleNext(),
        onPrev: () => handlePrev(),
        onSeekForward: (s) => handleSeek(currentTime + s),
        onSeekBackward: (s) => handleSeek(Math.max(0, currentTime - s)),
        onSeekTo: (t) => handleSeek(t)
      })
    }

    init()

    const cleanupShortcuts = setupKeyboardShortcuts({
      onPlayPause: () => handlePlayPause(),
      onNextTrack: () => handleNext(),
      onPrevTrack: () => handlePrev(),
      onSeekForward: (s) => handleSeek(currentTime + s),
      onSeekBackward: (s) => handleSeek(Math.max(0, currentTime - s)),
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
      audioEngineRef.current?.destroy()
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

  useEffect(() => {
    if (mainRef.current) {
      setupDragDrop(mainRef.current, async (files) => {
        await handleDroppedFiles(files)
      })
    }
  }, [songs])

  const handleDroppedFiles = async (files: File[]) => {
    setIsLoading(true)
    try {
      const newSongs = await handleFiles(files, {
        onProgress: (current, total, fileName) => {
          console.log(`Processing ${current}/${total}: ${fileName}`)
        }
      })

      const existingSongs = songs
      const uniqueSongs = newSongs.filter(ns =>
        !existingSongs.some(es => calculateSimilarity(es, ns) < 0.85)
      )

      if (uniqueSongs.length > 0) {
        const addedSongs = await addSongs(uniqueSongs)
        const allSongs = [...existingSongs, ...addedSongs]
        setSongs(allSongs)
        setFilteredSongs(allSongs)
      }

      const dups = findDuplicates([...songs, ...newSongs], 0.85)
      if (dups.length > 0) {
        setDuplicates(dups)
      }
    } catch (err) {
      console.error('Failed to add files:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddFolder = async () => {
    if (supportsFileSystemAccess()) {
      const dirHandle = await requestDirectoryPermission()
      if (dirHandle) {
        setIsLoading(true)
        try {
          const newSongs = await scanDirectory(dirHandle as any, {
            onProgress: (current, total, fileName) => {
              console.log(`Scanning ${current}/${total}: ${fileName}`)
            }
          })

          const existingSongs = songs
          const uniqueSongs = newSongs.filter(ns =>
            !existingSongs.some(es => calculateSimilarity(es, ns) < 0.85)
          )

          if (uniqueSongs.length > 0) {
            const addedSongs = await addSongs(uniqueSongs)
            const allSongs = [...existingSongs, ...addedSongs]
            setSongs(allSongs)
            setFilteredSongs(allSongs)
          }
        } catch (err) {
          console.error('Failed to scan directory:', err)
        } finally {
          setIsLoading(false)
        }
      }
    } else {
      if (!folderInputRef.current) {
        folderInputRef.current = document.createElement('input')
      }
      const input = folderInputRef.current
      setIsLoading(true)
      try {
        const newSongs = await setupWebkitDirectoryInput(input, {
          onProgress: (current, total, fileName) => {
            console.log(`Scanning ${current}/${total}: ${fileName}`)
          }
        })

        const existingSongs = songs
        const uniqueSongs = newSongs.filter(ns =>
          !existingSongs.some(es => calculateSimilarity(es, ns) < 0.85)
        )

        if (uniqueSongs.length > 0) {
          const addedSongs = await addSongs(uniqueSongs)
          const allSongs = [...existingSongs, ...addedSongs]
          setSongs(allSongs)
          setFilteredSongs(allSongs)
        }
      } catch (err) {
        console.error('Failed to scan directory:', err)
      } finally {
        setIsLoading(false)
      }
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
        setIsLoading(true)
        try {
          const newSongs = await handleFiles(input.files)
          const existingSongs = songs
          const uniqueSongs = newSongs.filter(ns =>
            !existingSongs.some(es => calculateSimilarity(es, ns) < 0.85)
          )

          if (uniqueSongs.length > 0) {
            const addedSongs = await addSongs(uniqueSongs)
            const allSongs = [...existingSongs, ...addedSongs]
            setSongs(allSongs)
            setFilteredSongs(allSongs)
          }
        } catch (err) {
          console.error('Failed to add files:', err)
        } finally {
          setIsLoading(false)
        }
      }
    }
    input.click()
  }

  const handlePlaySong = async (index: number) => {
    const songList = getCurrentSongList()
    const song = songList[index]
    if (!song || !audioEngineRef.current) return

    storePlaySong(index)
    setCurrentSong(song)
    setDuration(song.duration)

    try {
      const file = await getFileForSong(song)
      if (file) {
        await audioEngineRef.current.loadSong(song, file)
        audioEngineRef.current.play()
        setIsPlaying(true)
        setCurrentTime(0)

        await recordPlay(song.id, song.duration)

        const lyricsData = await getSongLyrics(song.id, song.title, song.artist)
        setLyrics(lyricsData)

        if (autoEq) {
          applyAutoEQ(song)
        }
      }
    } catch (err) {
      console.error('Failed to play song:', err)
    }
  }

  const getFileForSong = async (song: Song): Promise<File | null> => {
    return null
  }

  const handlePlayPause = useCallback(() => {
    if (!audioEngineRef.current || !currentSong) return

    if (isPlaying) {
      audioEngineRef.current.pause()
      setIsPlaying(false)
    } else {
      audioEngineRef.current.play()
      setIsPlaying(true)
    }
    updateMediaSessionPlaybackState(!isPlaying)
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

    handlePlaySong(nextIndex)
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
    const genre = song.genre?.[0]?.toLowerCase() || ''

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
    } else if (genre.includes('vocal') || genre.includes('vocaloid')) {
      applyEqPreset('vocal')
    }
  }

  const handleViewChange = (view: any) => {
    setCurrentView(view)
  }

  const handleThemeChange = async (newTheme: any) => {
    applyTheme(newTheme)
    setTheme(newTheme)
    await saveTheme(newTheme)
  }

  const handleRemoveSong = async (song: Song) => {
    await deleteSong(song.id)
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
              type={visualizer.type}
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
              eqPreset={eqPreset}
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
