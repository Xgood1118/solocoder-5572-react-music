import { useState, useRef, useEffect } from 'react'
import type { Song } from '../types'
import { formatDuration, formatFileSize } from '../utils'

interface PlaylistProps {
  songs: Song[]
  currentIndex: number
  isPlaying: boolean
  currentView: 'library' | 'search' | 'recent' | 'top' | 'queue'
  onPlaySong: (index: number) => void
  onAddToQueue: (song: Song) => void
  onViewMetadata: (song: Song) => void
  onRemoveSong: (song: Song) => void
  onShowInFolder?: (song: Song) => void
  searchQuery?: string
  queueSongs?: Song[]
}

export function Playlist({
  songs,
  currentIndex,
  isPlaying,
  currentView,
  onPlaySong,
  onAddToQueue,
  onViewMetadata,
  onRemoveSong,
  onShowInFolder,
  searchQuery = '',
  queueSongs = []
}: PlaylistProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; song: Song; index: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, song: Song, index: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, song, index })
  }

  const displaySongs = currentView === 'queue' ? queueSongs : songs
  const displayIndex = currentView === 'queue' ? -1 : currentIndex

  if (displaySongs.length === 0) {
    return (
      <div className="playlist-empty">
        <div className="empty-icon" aria-hidden="true">♪</div>
        <p>暂无歌曲</p>
        <p className="empty-hint">
          {currentView === 'library'
            ? '点击"添加音乐"导入本地音乐文件'
            : currentView === 'search'
            ? `未找到与"${searchQuery}"相关的歌曲`
            : '暂无数据'}
        </p>
      </div>
    )
  }

  return (
    <div className="playlist-container">
      <div className="playlist-header">
        <span className="col-index">#</span>
        <span className="col-title">标题</span>
        <span className="col-artist">艺术家</span>
        <span className="col-album">专辑</span>
        <span className="col-duration">时长</span>
      </div>
      <div className="playlist-scroll">
        {displaySongs.map((song, index) => {
          const isCurrent = index === displayIndex && currentView !== 'queue'
          return (
            <div
              key={song.id}
              className={`playlist-item ${isCurrent ? 'active' : ''}`}
              onDoubleClick={() => onPlaySong(index)}
              onContextMenu={(e) => handleContextMenu(e, song, index)}
              role="button"
              tabIndex={0}
              aria-label={`播放 ${song.title} - ${song.artist}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPlaySong(index)
                }
              }}
            >
              <span className="col-index">
                {isCurrent && isPlaying ? (
                  <span className="playing-indicator" aria-label="正在播放">
                    <span className="bar bar-1" />
                    <span className="bar bar-2" />
                    <span className="bar bar-3" />
                  </span>
                ) : (
                  index + 1
                )}
              </span>
              <span className="col-title">
                <span className="song-name">{song.title}</span>
              </span>
              <span className="col-artist">{song.artist}</span>
              <span className="col-album">{song.album}</span>
              <span className="col-duration">{formatDuration(song.duration)}</span>
            </div>
          )
        })}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onPlaySong(contextMenu.index)
              setContextMenu(null)
            }}
          >
            ▶ 播放
          </button>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onAddToQueue(contextMenu.song)
              setContextMenu(null)
            }}
          >
            ➕ 添加到队列
          </button>
          <div className="menu-divider" />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onViewMetadata(contextMenu.song)
              setContextMenu(null)
            }}
          >
            ℹ️ 查看元数据
          </button>
          {onShowInFolder && (
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                onShowInFolder(contextMenu.song)
                setContextMenu(null)
              }}
            >
              📁 定位到文件夹
            </button>
          )}
          <div className="menu-divider" />
          <button
            className="menu-item danger"
            role="menuitem"
            onClick={() => {
              onRemoveSong(contextMenu.song)
              setContextMenu(null)
            }}
          >
            🗑 从库移除
          </button>
        </div>
      )}
    </div>
  )
}
