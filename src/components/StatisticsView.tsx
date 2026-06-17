import type { StatisticsData, Song } from '../types'
import { formatDuration, formatFileSize } from '../utils'

interface StatisticsViewProps {
  stats: StatisticsData
  songs: Song[]
  period: 'week' | 'month' | 'year' | 'all'
  onPeriodChange: (period: 'week' | 'month' | 'year' | 'all') => void
}

export function StatisticsView({
  stats,
  songs,
  period,
  onPeriodChange
}: StatisticsViewProps) {
  const periods = [
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'year', label: '本年' },
    { value: 'all', label: '全部' }
  ] as const

  return (
    <div className="statistics-view">
      <div className="stats-header">
        <h2>统计</h2>
        <div className="period-selector">
          {periods.map((p) => (
            <button
              key={p.value}
              className={`period-btn ${period === p.value ? 'active' : ''}`}
              onClick={() => onPeriodChange(p.value)}
              aria-pressed={period === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">🎵</div>
          <div className="stat-info">
            <span className="stat-number">{stats.totalSongs}</span>
            <span className="stat-label">首歌曲</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏱</div>
          <div className="stat-info">
            <span className="stat-number">{formatDuration(stats.totalDuration)}</span>
            <span className="stat-label">总时长</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">▶</div>
          <div className="stat-info">
            <span className="stat-number">{stats.totalPlayCount}</span>
            <span className="stat-label">播放次数</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎤</div>
          <div className="stat-info">
            <span className="stat-number">{stats.topArtists.length}</span>
            <span className="stat-label">位艺术家</span>
          </div>
        </div>
      </div>

      <div className="stats-sections">
        <div className="stats-section">
          <h3>最爱歌曲 TOP 10</h3>
          <div className="top-list">
            {stats.topSongs.slice(0, 10).map((song, index) => (
              <div key={song.id} className="top-item">
                <span className="top-rank">{index + 1}</span>
                <div className="top-song-info">
                  <div className="top-song-title">{song.title}</div>
                  <div className="top-song-artist">{song.artist}</div>
                </div>
                <span className="top-play-count">{song.playCount} 次</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section">
          <h3>常听歌手 TOP 10</h3>
          <div className="top-list">
            {stats.topArtists.slice(0, 10).map((item, index) => (
              <div key={item.artist} className="top-item">
                <span className="top-rank">{index + 1}</span>
                <div className="top-song-info">
                  <div className="top-song-title">{item.artist}</div>
                </div>
                <span className="top-play-count">{item.playCount} 次</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
