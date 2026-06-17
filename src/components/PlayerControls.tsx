import { useState, useRef, useCallback, useEffect } from 'react'
import type { Song, PlayMode } from '../types'
import { formatTime, formatDuration } from '../utils'

interface PlayerControlsProps {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playMode: PlayMode
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onVolumeChange: (volume: number) => void
  onMuteToggle: () => void
  onPlayModeChange: (mode: PlayMode) => void
  onShowEqualizer: () => void
  onShowLyrics: () => void
  onShowPlaylist: () => void
}

export function PlayerControls({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  playMode,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onPlayModeChange,
  onShowEqualizer,
  onShowLyrics,
  onShowPlaylist
}: PlayerControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    onSeek(percent * duration)
  }, [duration, onSeek])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressClick(e)
  }, [handleProgressClick])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current || !duration) return
      const rect = progressRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      onSeek(percent * duration)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, duration, onSeek])

  const cyclePlayMode = () => {
    const modes: PlayMode[] = ['sequential', 'single', 'repeat', 'shuffle']
    const currentIndex = modes.indexOf(playMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    onPlayModeChange(nextMode)
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const playModeIcon = {
    sequential: '↔',
    single: '⟳',
    repeat: '🔁',
    shuffle: '🔀'
  }

  const playModeLabel = {
    sequential: '顺序播放',
    single: '单曲循环',
    repeat: '列表循环',
    shuffle: '随机播放'
  }

  return (
    <div className="player-controls" role="region" aria-label="播放控制">
      <div className="song-info">
        <div className="album-art">
          {currentSong?.albumArt ? (
            <img src={currentSong.albumArt} alt={`${currentSong.album} 封面`} />
          ) : (
            <div className="album-art-placeholder" aria-hidden="true">♪</div>
          )}
        </div>
        <div className="song-details">
          <div className="song-title" title={currentSong?.title || ''}>
            {currentSong?.title || '未选择歌曲'}
          </div>
          <div className="song-artist" title={currentSong?.artist || ''}>
            {currentSong?.artist || '—'}
          </div>
        </div>
      </div>

      <div className="controls-center">
        <div className="control-buttons">
          <button
            className="control-btn mode-btn"
            onClick={cyclePlayMode}
            title={playModeLabel[playMode]}
            aria-label={playModeLabel[playMode]}
          >
            {playModeIcon[playMode]}
          </button>
          <button
            className="control-btn"
            onClick={onPrev}
            aria-label="上一首"
            title="上一首"
            disabled={!currentSong}
          >
            ⏮
          </button>
          <button
            className="control-btn play-btn"
            onClick={onPlayPause}
            aria-label={isPlaying ? '暂停' : '播放'}
            disabled={!currentSong}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="control-btn"
            onClick={onNext}
            aria-label="下一首"
            title="下一首"
            disabled={!currentSong}
          >
            ⏭
          </button>
        </div>

        <div className="progress-container">
          <span className="time current-time" aria-label="当前时间">
            {formatTime(currentTime)}
          </span>
          <div
            ref={progressRef}
            className="progress-bar"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            tabIndex={0}
          >
            <div className="progress-bg" />
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="progress-thumb"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span className="time total-time" aria-label="总时长">
            {formatDuration(duration || currentSong?.duration || 0)}
          </span>
        </div>
      </div>

      <div className="controls-right">
        <button
          className="control-btn"
          onClick={onShowPlaylist}
          aria-label="播放列表"
          title="播放列表"
        >
          ☰
        </button>
        <button
          className="control-btn"
          onClick={onShowLyrics}
          aria-label="歌词"
          title="歌词"
        >
          🎵
        </button>
        <button
          className="control-btn"
          onClick={onShowEqualizer}
          aria-label="均衡器"
          title="均衡器"
        >
          🎚
        </button>

        <div className="volume-control">
          <button
            className="control-btn"
            onClick={onMuteToggle}
            aria-label={muted ? '取消静音' : '静音'}
            title={muted ? '取消静音' : '静音'}
          >
            {muted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
          </button>
          <div className={`volume-slider ${showVolumeSlider ? 'visible' : ''}`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label="音量"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
