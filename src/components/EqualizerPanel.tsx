import { useState } from 'react'
import { EQ_FREQUENCIES, EQ_PRESETS, PRESET_NAMES } from '../constants'
import type { EffectConfig } from '../types'

interface EqualizerPanelProps {
  eqBands: number[]
  eqPreset: string
  autoEq: boolean
  effects: EffectConfig[]
  onEqBandChange: (index: number, gain: number) => void
  onPresetChange: (preset: string) => void
  onReset: () => void
  onAutoEqToggle: (auto: boolean) => void
  onToggleEffect: (type: string) => void
  onEffectParamChange: (type: string, param: string, value: number) => void
}

export function EqualizerPanel({
  eqBands,
  eqPreset,
  autoEq,
  effects,
  onEqBandChange,
  onPresetChange,
  onReset,
  onAutoEqToggle,
  onToggleEffect,
  onEffectParamChange
}: EqualizerPanelProps) {
  const [activeTab, setActiveTab] = useState<'eq' | 'effects'>('eq')

  const formatFreq = (freq: number): string => {
    if (freq >= 1000) {
      return `${freq / 1000}k`
    }
    return freq.toString()
  }

  const getEffectConfig = (type: string) => {
    return effects.find(e => e.type === type)
  }

  return (
    <div className="equalizer-panel" role="dialog" aria-label="均衡器设置">
      <div className="panel-header">
        <h3>音效设置</h3>
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'eq' ? 'active' : ''}`}
            onClick={() => setActiveTab('eq')}
          >
            均衡器
          </button>
          <button
            className={`tab-btn ${activeTab === 'effects' ? 'active' : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            音效
          </button>
        </div>
      </div>

      {activeTab === 'eq' && (
        <div className="eq-content">
          <div className="eq-presets">
            <label htmlFor="eq-preset">预设:</label>
            <select
              id="eq-preset"
              value={eqPreset}
              onChange={(e) => onPresetChange(e.target.value)}
              aria-label="EQ 预设"
            >
              {PRESET_NAMES.map(name => (
                <option key={name} value={name}>
                  {name === 'flat' ? '平坦' :
                   name === 'pop' ? '流行' :
                   name === 'rock' ? '摇滚' :
                   name === 'classical' ? '古典' :
                   name === 'jazz' ? '爵士' :
                   name === 'electronic' ? '电子' :
                   name === 'bass' ? '低音增强' :
                   name === 'treble' ? '高音增强' :
                   name === 'vocal' ? '人声' :
                   name === 'acoustic' ? '原声' : name}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
          </div>

          <div className="eq-auto">
            <label>
              <input
                type="checkbox"
                checked={autoEq}
                onChange={(e) => onAutoEqToggle(e.target.checked)}
              />
              <span>自动适配</span>
            </label>
          </div>

          <div className="eq-bands">
            {EQ_FREQUENCIES.map((freq, index) => (
              <div key={freq} className="eq-band">
                <div className="eq-band-value">{eqBands[index].toFixed(1)}dB</div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={eqBands[index]}
                  onChange={(e) => onEqBandChange(index, parseFloat(e.target.value))}
                  style={{ writingMode: 'vertical-lr' as any }}
                  aria-label={`${freq} Hz`}
                />
                <div className="eq-band-freq">{formatFreq(freq)}Hz</div>
              </div>
            ))}
          </div>

          <button className="reset-btn" onClick={onReset}>
            重置
          </button>
        </div>
      )}

      {activeTab === 'effects' && (
        <div className="effects-content">
          <div className="effect-item">
            <div className="effect-header">
              <label>
                <input
                  type="checkbox"
                  checked={getEffectConfig('reverb')?.enabled || false}
                  onChange={() => onToggleEffect('reverb')}
                />
                <span>混响</span>
              </label>
            </div>
            {getEffectConfig('reverb')?.enabled && (
              <div className="effect-params">
                <div className="param-row">
                  <label>混合度</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={getEffectConfig('reverb')?.params.mix || 0}
                    onChange={(e) => onEffectParamChange('reverb', 'mix', parseFloat(e.target.value))}
                  />
                  <span>{((getEffectConfig('reverb')?.params.mix || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="param-row">
                  <label>衰减时间</label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={getEffectConfig('reverb')?.params.decay || 2}
                    onChange={(e) => onEffectParamChange('reverb', 'decay', parseFloat(e.target.value))}
                  />
                  <span>{getEffectConfig('reverb')?.params.decay?.toFixed(1) || '2.0'}s</span>
                </div>
              </div>
            )}
          </div>

          <div className="effect-item">
            <div className="effect-header">
              <label>
                <input
                  type="checkbox"
                  checked={getEffectConfig('compressor')?.enabled || false}
                  onChange={() => onToggleEffect('compressor')}
                />
                <span>压缩器</span>
              </label>
            </div>
            {getEffectConfig('compressor')?.enabled && (
              <div className="effect-params">
                <div className="param-row">
                  <label>阈值</label>
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    step="1"
                    value={getEffectConfig('compressor')?.params.threshold || -24}
                    onChange={(e) => onEffectParamChange('compressor', 'threshold', parseFloat(e.target.value))}
                  />
                  <span>{getEffectConfig('compressor')?.params.threshold || -24}dB</span>
                </div>
                <div className="param-row">
                  <label>比率</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={getEffectConfig('compressor')?.params.ratio || 4}
                    onChange={(e) => onEffectParamChange('compressor', 'ratio', parseFloat(e.target.value))}
                  />
                  <span>{getEffectConfig('compressor')?.params.ratio || 4}:1</span>
                </div>
              </div>
            )}
          </div>

          <div className="effect-item">
            <div className="effect-header">
              <label>
                <input
                  type="checkbox"
                  checked={getEffectConfig('limiter')?.enabled || false}
                  onChange={() => onToggleEffect('limiter')}
                />
                <span>限幅器</span>
              </label>
            </div>
            {getEffectConfig('limiter')?.enabled && (
              <div className="effect-params">
                <div className="param-row">
                  <label>阈值</label>
                  <input
                    type="range"
                    min="-10"
                    max="0"
                    step="0.5"
                    value={getEffectConfig('limiter')?.params.threshold || -1}
                    onChange={(e) => onEffectParamChange('limiter', 'threshold', parseFloat(e.target.value))}
                  />
                  <span>{getEffectConfig('limiter')?.params.threshold || -1}dB</span>
                </div>
              </div>
            )}
          </div>

          <div className="effect-item">
            <div className="effect-header">
              <label>
                <input
                  type="checkbox"
                  checked={getEffectConfig('stereo')?.enabled || false}
                  onChange={() => onToggleEffect('stereo')}
                />
                <span>立体声扩展</span>
              </label>
            </div>
            {getEffectConfig('stereo')?.enabled && (
              <div className="effect-params">
                <div className="param-row">
                  <label>扩展宽度</label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={getEffectConfig('stereo')?.params.width || 0.5}
                    onChange={(e) => onEffectParamChange('stereo', 'width', parseFloat(e.target.value))}
                  />
                  <span>{(((getEffectConfig('stereo')?.params.width || 0) + 1) * 50).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
