import type { Song } from '../types'
import { formatDuration, formatFileSize } from '../utils'

interface SidebarProps {
  songs: Song[]
  currentView: 'library' | 'search' | 'recent' | 'top' | 'queue' | 'settings' | 'statistics'
  onViewChange: (view: SidebarProps['currentView']) => void
  onAddFolder: () => void
  onAddFiles: () => void
  totalSongs: number
  totalDuration: number
}

export function Sidebar({
  songs,
  currentView,
  onViewChange,
  onAddFolder,
  onAddFiles,
  totalSongs,
  totalDuration
}: SidebarProps) {
  const navItems = [
    { id: 'library', label: '音乐库', icon: '🎵' },
    { id: 'recent', label: '最近播放', icon: '🕐' },
    { id: 'top', label: '最多播放', icon: '🔥' },
    { id: 'queue', label: '播放队列', icon: '📋' },
    { id: 'statistics', label: '统计', icon: '📊' },
    { id: 'settings', label: '设置', icon: '⚙️' }
  ] as const

  return (
    <aside className="sidebar" role="navigation" aria-label="主导航">
      <div className="sidebar-header">
        <div className="logo" aria-hidden="true">♪</div>
        <h1 className="app-title">Music Player</h1>
      </div>

      <div className="add-buttons">
        <button
          className="add-btn primary"
          onClick={onAddFolder}
          aria-label="添加文件夹"
        >
          <span aria-hidden="true">📁</span>
          <span>添加文件夹</span>
        </button>
        <button
          className="add-btn"
          onClick={onAddFiles}
          aria-label="添加文件"
        >
          <span aria-hidden="true">📄</span>
          <span>添加文件</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
            aria-current={currentView === item.id ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.id === 'queue' && songs.length > 0 && (
              <span className="nav-badge">{songs.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="library-stats">
          <div className="stat-item">
            <span className="stat-value">{totalSongs}</span>
            <span className="stat-label">首歌曲</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatDuration(totalDuration).split(':')[0]}</span>
            <span className="stat-label">小时</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
