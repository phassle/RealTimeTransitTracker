// PROTOTYPE — Variant C "Icon Rail", Palantir-inspired operational reskin.
// A thin vertical rail of icons; each opens a contextual flyout. Dense, technical,
// monospace readouts, hairline borders, uppercase micro-labels — a command-console
// feel rather than a friendly widget panel.
import { useState } from 'react';
import './VariantIconRail.css';
import { MODES, MODE_COLORS } from '../../services/modes';
import { countByMode, filterLines } from './prototypeShared';

export function VariantIconRail(props) {
  const {
    vehicles = [], loading, lastUpdate, onRefresh,
    enabledModes = [], onModeToggle,
    availableLines = {}, isLineSelected = () => false, onLineToggle = () => {},
    selectedLines = [], onClearLines = () => {},
    operators = [], activeOperators = [], onRegionSelect = () => {},
    effectiveInterval = 2000, theme, onToggleTheme,
    webcamsEnabled, onWebcamsToggle, webcamCount = 0,
  } = props;

  const [panel, setPanel] = useState('stats'); // open by default so it's not empty
  const [search, setSearch] = useState('');
  const stats = countByMode(vehicles);
  const lineOptions = filterLines(availableLines, search);
  const sel = (p) => setPanel(cur => (cur === p ? null : p));

  const RAIL = [
    { id: 'stats', icon: '◧', label: 'Overview' },
    { id: 'modes', icon: '◈', label: 'Modes' },
    { id: 'regions', icon: '⬡', label: 'Regions' },
    { id: 'lines', icon: '≣', label: 'Lines', badge: selectedLines.length },
    { id: 'layers', icon: '⊞', label: 'Layers' },
  ];

  return (
    <div className="rail-root">
      <nav className="rail" aria-label="Control rail">
        <div className="rail-logo" title="Sweden Real-Time Transit">STT</div>
        {RAIL.map(item => (
          <button
            key={item.id}
            className={`rail-btn ${panel === item.id ? 'active' : ''}`}
            onClick={() => sel(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={panel === item.id}
          >
            <span className="rail-glyph">{item.icon}</span>
            {item.badge > 0 && <span className="rail-dot">{item.badge}</span>}
          </button>
        ))}
        <div className="rail-spacer" />
        <button className="rail-btn" onClick={onRefresh} disabled={loading} title="Refresh feed">
          <span className={`rail-glyph ${loading ? 'spin' : ''}`}>⟳</span>
        </button>
        <button className="rail-btn" onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle theme">
          <span className="rail-glyph">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
      </nav>

      {panel && (
        <section className="rail-flyout" aria-label={RAIL.find(r => r.id === panel)?.label}>
          <div className="rail-status">
            <span className={`rail-led ${loading ? 'busy' : 'live'}`} />
            <span className="rail-status-text">
              {loading ? 'SYNC' : 'LIVE'} · {(effectiveInterval / 1000).toFixed(1)}S · {activeOperators.length} OPR
            </span>
            <span className="rail-status-clock">{lastUpdate ? lastUpdate.toLocaleTimeString('sv-SE') : '—'}</span>
          </div>

          {panel === 'stats' && (
            <>
              <h3>Overview</h3>
              <div className="rail-readout">
                <div className="rail-readout-cell">
                  <span className="rail-readout-num">{String(vehicles.length).padStart(3, '0')}</span>
                  <span className="rail-readout-cap">Vehicles tracked</span>
                </div>
                <div className="rail-readout-cell">
                  <span className="rail-readout-num">{String(activeOperators.length).padStart(2, '0')}</span>
                  <span className="rail-readout-cap">Active operators</span>
                </div>
              </div>
              <div className="rail-modebars">
                {MODES.filter(m => stats[m.id]).map(m => {
                  const pct = Math.round((stats[m.id] / Math.max(1, vehicles.length)) * 100);
                  return (
                    <div key={m.id} className="rail-bar">
                      <span className="rail-bar-label">{m.label}</span>
                      <div className="rail-bar-track"><div className="rail-bar-fill" style={{ width: `${pct}%`, background: m.color }} /></div>
                      <span className="rail-bar-num">{String(stats[m.id]).padStart(3, ' ')}</span>
                    </div>
                  );
                })}
                {vehicles.length === 0 && <div className="rail-empty">No vehicles in viewport</div>}
              </div>
            </>
          )}

          {panel === 'modes' && (
            <>
              <h3>Transport modes</h3>
              <div className="rail-modelist">
                {MODES.map(m => {
                  const on = enabledModes.includes(m.id);
                  return (
                    <button key={m.id} className={`rail-mode ${on ? 'on' : ''}`} onClick={() => onModeToggle(m.id)} aria-pressed={on}>
                      <span className="rail-swatch" style={{ background: m.color }} />
                      <span className="rail-mode-name">{m.label}</span>
                      <span className="rail-mode-count">{String(stats[m.id] || 0).padStart(3, '0')}</span>
                      <span className={`rail-toggle ${on ? 'on' : ''}`} />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {panel === 'regions' && (
            <>
              <h3>Regions</h3>
              <div className="rail-chips">
                <button className="rail-chip all" onClick={() => onRegionSelect(null)}>ALL SWEDEN</button>
                {operators.map(op => (
                  <button
                    key={op.slug}
                    className={`rail-chip ${activeOperators.includes(op.slug) ? 'active' : ''}`}
                    onClick={() => onRegionSelect(op.slug)}
                    title={op.region}
                  >{op.name}</button>
                ))}
              </div>
            </>
          )}

          {panel === 'lines' && (
            <>
              <h3>Filter · line{selectedLines.length > 0 && <button className="rail-clear" onClick={onClearLines}>CLR {selectedLines.length}</button>}</h3>
              <input className="rail-search" placeholder="QUERY LINES…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className="rail-chips scroll">
                {Object.entries(lineOptions).flatMap(([mode, lines]) =>
                  lines.map(({ line }) => (
                    <button
                      key={`${mode}:${line}`}
                      className={`rail-chip ${isLineSelected(mode, line) ? 'active' : ''}`}
                      style={{ '--accent': MODE_COLORS[mode] || '#888' }}
                      onClick={() => onLineToggle(mode, line)}
                    >{line}</button>
                  )),
                )}
                {Object.keys(lineOptions).length === 0 && <span className="rail-empty">No matching lines</span>}
              </div>
            </>
          )}

          {panel === 'layers' && (
            <>
              <h3>Layers</h3>
              <button className={`rail-mode ${webcamsEnabled ? 'on' : ''}`} onClick={onWebcamsToggle} aria-pressed={webcamsEnabled}>
                <span className="rail-swatch" style={{ background: '#2c3e50' }} />
                <span className="rail-mode-name">Webcams</span>
                <span className="rail-mode-count">{webcamsEnabled ? String(webcamCount).padStart(3, '0') : '—'}</span>
                <span className={`rail-toggle ${webcamsEnabled ? 'on' : ''}`} />
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
