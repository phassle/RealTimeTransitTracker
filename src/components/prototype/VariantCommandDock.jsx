// PROTOTYPE — Variant B "Command Dock". Horizontal bar pinned to the bottom.
// Different hierarchy: stats inline left, segmented mode control as the hero,
// regions/lines/layers behind popovers that open *upward* from the dock.
import { useState } from 'react';
import './VariantCommandDock.css';
import { MODES, MODE_COLORS } from '../../services/modes';
import { countByMode, filterLines } from './prototypeShared';

export function VariantCommandDock(props) {
  const {
    vehicles = [], loading, onRefresh,
    enabledModes = [], onModeToggle,
    availableLines = {}, isLineSelected = () => false, onLineToggle = () => {},
    selectedLines = [],
    operators = [], activeOperators = [], onRegionSelect = () => {},
    theme, onToggleTheme,
    webcamsEnabled, onWebcamsToggle, webcamCount = 0,
  } = props;

  const [open, setOpen] = useState(null); // 'regions' | 'lines' | null
  const [search, setSearch] = useState('');
  const stats = countByMode(vehicles);
  const lineOptions = filterLines(availableLines, search);
  const toggle = (p) => setOpen(o => (o === p ? null : p));

  return (
    <div className="dock-root">
      {open === 'regions' && (
        <div className="dock-pop">
          <div className="dock-pop-title">Regions</div>
          <div className="dock-pop-chips">
            <button className="dock-chip all" onClick={() => { onRegionSelect(null); setOpen(null); }}>All Sweden</button>
            {operators.map(op => (
              <button
                key={op.slug}
                className={`dock-chip ${activeOperators.includes(op.slug) ? 'active' : ''}`}
                onClick={() => { onRegionSelect(op.slug); setOpen(null); }}
                title={op.region}
              >{op.name}</button>
            ))}
          </div>
        </div>
      )}
      {open === 'lines' && (
        <div className="dock-pop">
          <div className="dock-pop-title">Filter by line</div>
          <input className="dock-search" placeholder="Search lines…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="dock-pop-chips scroll">
            {Object.entries(lineOptions).flatMap(([mode, lines]) =>
              lines.map(({ line }) => (
                <button
                  key={`${mode}:${line}`}
                  className={`dock-chip ${isLineSelected(mode, line) ? 'active' : ''}`}
                  style={{ '--accent': MODE_COLORS[mode] || '#888' }}
                  onClick={() => onLineToggle(mode, line)}
                >{line}</button>
              )),
            )}
            {Object.keys(lineOptions).length === 0 && <span className="dock-empty">No matching lines</span>}
          </div>
        </div>
      )}

      <div className="dock">
        <div className="dock-stats">
          <div className="dock-stat"><b>{vehicles.length}</b><span>vehicles</span></div>
          <div className="dock-stat"><b>{activeOperators.length}</b><span>operators</span></div>
        </div>

        <div className="dock-divider" />

        <div className="dock-segment" role="group" aria-label="Transport modes">
          {MODES.map(m => {
            const on = enabledModes.includes(m.id);
            return (
              <button
                key={m.id}
                className={`dock-seg ${on ? 'on' : ''}`}
                onClick={() => onModeToggle(m.id)}
                style={on ? { background: m.color, borderColor: m.color, color: '#fff' } : {}}
                title={`${m.label} (${stats[m.id] || 0})`}
              >
                {m.label}
                <span className="dock-seg-count">{stats[m.id] || 0}</span>
              </button>
            );
          })}
        </div>

        <div className="dock-divider" />

        <div className="dock-actions">
          <button className={`dock-btn ${open === 'regions' ? 'open' : ''}`} onClick={() => toggle('regions')}>🌍 Regions</button>
          <button className={`dock-btn ${open === 'lines' ? 'open' : ''}`} onClick={() => toggle('lines')}>
            🚏 Lines{selectedLines.length > 0 && <span className="dock-badge">{selectedLines.length}</span>}
          </button>
          <button className={`dock-btn ${webcamsEnabled ? 'open' : ''}`} onClick={onWebcamsToggle}>
            📷 Webcams{webcamsEnabled ? ` ${webcamCount}` : ''}
          </button>
          <button className="dock-btn icon" onClick={onRefresh} disabled={loading} title="Refresh">{loading ? '⟳' : '🔄'}</button>
          <button className="dock-btn icon" onClick={onToggleTheme} title="Theme">{theme === 'dark' ? '☀' : '🌙'}</button>
        </div>
      </div>
    </div>
  );
}
