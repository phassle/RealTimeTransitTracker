// PROTOTYPE — Variant A "Glass HUD". Frosted vertical panel, hero stats,
// glowing segmented mode pills. Structurally close to current but premium reskin.
import { useState } from 'react';
import './VariantGlassHud.css';
import { MODES, MODE_COLORS, MODE_LABELS } from '../../services/modes';
import { countByMode, filterLines } from './prototypeShared';

export function VariantGlassHud(props) {
  const {
    vehicles = [], loading, lastUpdate, onRefresh,
    enabledModes = [], onModeToggle,
    availableLines = {}, isLineSelected = () => false, onLineToggle = () => {},
    selectedLines = [], onClearLines = () => {},
    operators = [], activeOperators = [], onRegionSelect = () => {},
    effectiveInterval = 2000, theme, onToggleTheme,
    webcamsEnabled, onWebcamsToggle, webcamCount = 0,
  } = props;

  const [search, setSearch] = useState('');
  const stats = countByMode(vehicles);
  const lineOptions = filterLines(availableLines, search);

  return (
    <div className="glass-hud">
      <div className="glass-hud-top">
        <div className="glass-hud-title">
          <span className="glass-hud-pulse" />
          <div>
            <h2>Sweden Transit</h2>
            <small>Live · every {effectiveInterval / 1000}s</small>
          </div>
        </div>
        <button className="glass-hud-icon" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>

      <div className="glass-hud-hero">
        <div className="glass-hud-metric">
          <span className="glass-hud-num">{vehicles.length}</span>
          <span className="glass-hud-cap">vehicles</span>
        </div>
        <div className="glass-hud-metric">
          <span className="glass-hud-num">{activeOperators.length}</span>
          <span className="glass-hud-cap">operators</span>
        </div>
        <button className="glass-hud-refresh" onClick={onRefresh} disabled={loading} title="Refresh now">
          {loading ? '⟳' : '⟳'}
        </button>
      </div>

      <div className="glass-hud-modes">
        {MODES.map(m => {
          const on = enabledModes.includes(m.id);
          return (
            <button
              key={m.id}
              className={`glass-hud-pill ${on ? 'on' : ''}`}
              onClick={() => onModeToggle(m.id)}
              style={on ? { '--accent': m.color, borderColor: m.color, boxShadow: `0 0 12px ${m.color}66` } : { '--accent': m.color }}
            >
              <span className="glass-hud-dot" style={{ background: m.color }} />
              {m.label}
              <span className="glass-hud-pill-count">{stats[m.id] || 0}</span>
            </button>
          );
        })}
      </div>

      <label className="glass-hud-layer">
        <input type="checkbox" checked={webcamsEnabled} onChange={onWebcamsToggle} />
        <span>Webcams {webcamsEnabled ? `· ${webcamCount}` : ''}</span>
      </label>

      <div className="glass-hud-regions">
        <button className="glass-hud-region all" onClick={() => onRegionSelect(null)}>All Sweden</button>
        {operators.map(op => (
          <button
            key={op.slug}
            className={`glass-hud-region ${activeOperators.includes(op.slug) ? 'active' : ''}`}
            onClick={() => onRegionSelect(op.slug)}
            title={op.region}
          >
            {op.name}
          </button>
        ))}
      </div>

      <div className="glass-hud-lines">
        <input
          className="glass-hud-search"
          placeholder="🔍 Search lines…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {selectedLines.length > 0 && (
          <button className="glass-hud-clear" onClick={onClearLines}>Clear {selectedLines.length} selected</button>
        )}
        <div className="glass-hud-line-scroll">
          {Object.entries(lineOptions).map(([mode, lines]) => (
            <div key={mode} className="glass-hud-line-group">
              {lines.map(({ line }) => (
                <span
                  key={`${mode}:${line}`}
                  className={`glass-hud-chip ${isLineSelected(mode, line) ? 'sel' : ''}`}
                  style={{ '--accent': MODE_COLORS[mode] || '#888' }}
                  onClick={() => onLineToggle(mode, line)}
                >
                  {line}
                </span>
              ))}
            </div>
          ))}
          {Object.keys(lineOptions).length === 0 && <div className="glass-hud-empty">No matching lines</div>}
        </div>
      </div>

      {lastUpdate && (
        <div className="glass-hud-foot">Updated {lastUpdate.toLocaleTimeString('sv-SE')}</div>
      )}
    </div>
  );
}
