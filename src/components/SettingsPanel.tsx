import type { ThemeConfig, ThemeMode, VisualizerConfig } from '../types'
import { THEMES } from '../services/theme'
import { PRESET_NAMES } from '../constants'

interface SettingsPanelProps {
  theme: ThemeConfig
  visualizer: VisualizerConfig
  onThemeChange: (theme: ThemeConfig) => void
  onVisualizerChange: (config: VisualizerConfig) => void
}

export function SettingsPanel({
  theme,
  visualizer,
  onThemeChange,
  onVisualizerChange
}: SettingsPanelProps) {
  const themeModes: ThemeMode[] = ['light', 'dark', 'cyber', 'retro', 'minimal']

  const visualizerTypes = [
    { value: 'spectrum', label: '频谱' },
    { value: 'waveform', label: '波形' },
    { value: 'circular', label: '环形' },
    { value: 'flame', label: '火焰' },
    { value: 'particles', label: '粒子' },
    { value: 'starfield', label: '星空' }
  ]

  return (
    <div className="settings-panel" role="dialog" aria-label="设置">
      <div className="settings-section">
        <h4>主题</h4>
        <div className="theme-list">
          {themeModes.map((mode) => (
            <button
              key={mode}
              className={`theme-option ${theme.mode === mode ? 'active' : ''}`}
              onClick={() => onThemeChange({ ...theme, mode })}
              aria-pressed={theme.mode === mode}
            >
              <div className={`theme-preview theme-${mode}`} aria-hidden="true" />
              <span className="theme-name">{THEMES[mode].name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h4>主题色</h4>
        <div className="color-picker">
          <input
            type="color"
            value={theme.primaryColor}
            onChange={(e) => onThemeChange({ ...theme, primaryColor: e.target.value })}
            aria-label="自定义主题色"
          />
          <input
            type="text"
            value={theme.primaryColor}
            onChange={(e) => {
              const val = e.target.value
              if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                onThemeChange({ ...theme, primaryColor: val })
              }
            }}
            aria-label="主题色值"
          />
        </div>
        <div className="preset-colors">
          {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#00f5ff', '#ff6b35', '#333333'].map((color) => (
            <button
              key={color}
              className="preset-color"
              style={{ backgroundColor: color }}
              onClick={() => onThemeChange({ ...theme, primaryColor: color })}
              aria-label={`主题色 ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h4>可视化效果</h4>
        <div className="visualizer-types">
          {visualizerTypes.map((v) => (
            <button
              key={v.value}
              className={`visualizer-option ${visualizer.type === v.value ? 'active' : ''}`}
              onClick={() => onVisualizerChange({ ...visualizer, type: v.value as any })}
              aria-pressed={visualizer.type === v.value}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h4>可视化设置</h4>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={visualizer.beatSync}
              onChange={(e) => onVisualizerChange({ ...visualizer, beatSync: e.target.checked })}
            />
            <span>节拍同步</span>
          </label>
        </div>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={visualizer.mouseInteraction}
              onChange={(e) => onVisualizerChange({ ...visualizer, mouseInteraction: e.target.checked })}
            />
            <span>鼠标互动</span>
          </label>
        </div>
        <div className="setting-row">
          <label>灵敏度</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={visualizer.sensitivity}
            onChange={(e) => onVisualizerChange({ ...visualizer, sensitivity: parseFloat(e.target.value) })}
            aria-label="可视化灵敏度"
          />
          <span>{(visualizer.sensitivity * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="settings-section">
        <h4>关于</h4>
        <p className="about-text">
          React Music Player v1.0.0
        </p>
        <p className="about-text">
          基于 Web Audio API 的本地音乐播放器
        </p>
      </div>
    </div>
  )
}
