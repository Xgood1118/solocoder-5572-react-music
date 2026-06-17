import type { Song } from '../types'
import { formatDuration, formatFileSize } from '../utils'

interface MetadataViewerProps {
  song: Song | null
  onClose: () => void
}

export function MetadataViewer({ song, onClose }: MetadataViewerProps) {
  if (!song) return null

  const fields = [
    { label: '标题', value: song.title },
    { label: '艺术家', value: song.artist },
    { label: '专辑', value: song.album },
    { label: '时长', value: formatDuration(song.duration) },
    { label: '文件格式', value: song.format?.toUpperCase() || '未知' },
    { label: '文件大小', value: formatFileSize(song.fileSize) },
    { label: '比特率', value: song.bitrate ? `${(song.bitrate / 1000).toFixed(0)} kbps` : '未知' },
    { label: '采样率', value: song.sampleRate ? `${song.sampleRate} Hz` : '未知' },
    { label: '流派', value: song.genre?.join(', ') || '未知' },
    { label: '年份', value: song.year || '未知' },
    { label: '曲目号', value: song.trackNumber || '未知' },
    { label: '播放次数', value: song.playCount },
    { label: '评分', value: `${song.rating} 星` },
    { label: '添加时间', value: new Date(song.addedAt).toLocaleString() },
    { label: '最后播放', value: song.lastPlayedAt ? new Date(song.lastPlayedAt).toLocaleString() : '从未播放' },
    { label: '文件路径', value: song.filePath }
  ]

  return (
    <div className="metadata-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="metadata-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="metadata-header">
          <h3>元数据</h3>
          <button className="close-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="metadata-content">
          {song.albumArt && (
            <div className="metadata-cover">
              <img src={song.albumArt} alt={`${song.album} 封面`} />
            </div>
          )}

          <div className="metadata-fields">
            {fields.map((field) => (
              <div key={field.label} className="metadata-field">
                <span className="field-label">{field.label}</span>
                <span className="field-value" title={String(field.value)}>
                  {field.value}
                </span>
              </div>
            ))}
          </div>

          {song.comments && (
            <div className="metadata-comments">
              <h4>备注</h4>
              <p>{song.comments}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
