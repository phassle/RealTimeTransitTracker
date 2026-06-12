import { useState, useMemo } from 'react';
import './ControlPanel.css';
import { MODES, MODE_COLORS as MODE_COLOR_MAP, MODE_LABELS as MODE_LABEL_MAP } from '../services/modes';

const TRANSPORT_MODES = MODES;

export function ControlPanel({
  vehicles = [],
  loading = false,
  error = null,
  lastUpdate = null,
  onRefresh = () => {},
  enabledModes = [],
  onModeToggle = () => {},
  availableLines = {},
  selectedLines = [],
  onLineToggle = () => {},
  onClearLines = () => {},
  operators = [],
  activeOperators = [],
  onRegionSelect = () => {},
  effectiveInterval = 2000,
  theme = 'light',
  onToggleTheme = () => {},
  webcamsEnabled = false,
  onWebcamsToggle = () => {},
  webcamsLoading = false,
  webcamsError = null,
  webcamCount = 0,
  cameraTypeDefinitions = [],
  enabledCameraTypes = [],
  cameraCounts = {},
  onCameraTypeToggle = () => {},
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [lineFilterExpanded, setLineFilterExpanded] = useState(false);
  const [lineSearch, setLineSearch] = useState('');

  const stats = vehicles.reduce((acc, v) => {
    acc[v.mode] = (acc[v.mode] || 0) + 1;
    return acc;
  }, {});

  const totalVisible = vehicles.length;

  const filteredLineOptions = useMemo(() => {
    if (!lineSearch.trim()) return availableLines;
    const query = lineSearch.trim().toLowerCase();
    const filtered = {};
    for (const [mode, lines] of Object.entries(availableLines)) {
      const modeLabel = (MODE_LABEL_MAP[mode] || mode).toLowerCase();
      const matching = lines.filter(
        ({ line }) => line.toLowerCase().includes(query) || modeLabel.includes(query)
      );
      if (matching.length > 0) filtered[mode] = matching;
    }
    return filtered;
  }, [availableLines, lineSearch]);

  const selectedLineSet = useMemo(() => new Set(selectedLines), [selectedLines]);

  return (
    <div className={`control-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="control-header">
        <h2>Sweden Real-Time Transit</h2>
        <button
          className="theme-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="region-selector">
            <h3>Regions</h3>
            <div className="region-chips">
              <button className="region-all" onClick={() => onRegionSelect(null)}>
                All Sweden
              </button>
              {operators.map(op => (
                <button
                  key={op.slug}
                  className={`region-chip ${activeOperators.includes(op.slug) ? 'active' : ''}`}
                  onClick={() => onRegionSelect(op.slug)}
                  title={op.region}
                >
                  {op.name}
                </button>
              ))}
            </div>
          </div>

          <div className="stats">
            <div className="stat-item">
              <span className="stat-label">Total vehicles:</span>
              <span className="stat-value">{totalVisible}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active operators:</span>
              <span className="stat-value">{activeOperators.length}</span>
            </div>
            {lastUpdate && (
              <div className="stat-item">
                <span className="stat-label">Last update:</span>
                <span className="stat-value">{lastUpdate.toLocaleTimeString('sv-SE')}</span>
              </div>
            )}
          </div>

          <div className="webcam-layer">
            <h3>Layers</h3>
            <label className="mode-filter">
              <input
                type="checkbox"
                checked={webcamsEnabled}
                onChange={onWebcamsToggle}
                aria-label="Toggle webcams layer"
              />
              <span className="mode-color" style={{ backgroundColor: '#2c3e50' }} />
              <span className="mode-label">Webcams</span>
              <span className="mode-count">
                {webcamsLoading
                  ? '(…)'
                  : webcamsEnabled
                    ? `(${webcamCount})`
                    : ''}
              </span>
            </label>
            {webcamsEnabled && webcamsError && (
              <div className="error-message" role="alert">
                ⚠️ Webcams unavailable
              </div>
            )}
            {webcamsEnabled && cameraTypeDefinitions.length > 0 && (
              <div className="camera-type-filters">
                {cameraTypeDefinitions.map(t => (
                  <label key={t.id} className="mode-filter">
                    <input
                      type="checkbox"
                      checked={enabledCameraTypes.includes(t.id)}
                      onChange={() => onCameraTypeToggle(t.id)}
                      aria-label={`Toggle ${t.label} cameras`}
                    />
                    {t.color && (
                      <span className="mode-color" style={{ backgroundColor: t.color }} />
                    )}
                    <span className="mode-label">{t.label}</span>
                    <span className="mode-count">({cameraCounts[t.id] || 0})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mode-filters">
            <h3>Transport Modes</h3>
            {TRANSPORT_MODES.map(mode => (
              <label key={mode.id} className="mode-filter">
                <input
                  type="checkbox"
                  checked={enabledModes.includes(mode.id)}
                  onChange={() => onModeToggle(mode.id)}
                />
                <span
                  className="mode-color"
                  style={{ backgroundColor: mode.color }}
                />
                <span className="mode-label">{mode.label}</span>
                <span className="mode-count">({stats[mode.id] || 0})</span>
              </label>
            ))}
          </div>

          <div className="line-filters">
            <div
              className="line-filters-header"
              onClick={() => setLineFilterExpanded(!lineFilterExpanded)}
            >
              <h3>
                Filter by Line
                {selectedLines.length > 0 && (
                  <span className="line-badge">{selectedLines.length}</span>
                )}
              </h3>
              <span className="line-expand-icon">
                {lineFilterExpanded ? '▾' : '▸'}
              </span>
            </div>

            {lineFilterExpanded && (
              <div className="line-filters-body">
                <input
                  type="text"
                  className="line-search"
                  placeholder="Search lines..."
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                />

                {selectedLines.length > 0 && (
                  <div className="selected-lines">
                    {selectedLines.map(key => {
                      const sepIdx = key.indexOf(':');
                      const mode = key.slice(0, sepIdx);
                      const line = key.slice(sepIdx + 1);
                      return (
                        <span
                          key={key}
                          className="line-chip selected"
                          style={{ borderColor: MODE_COLOR_MAP[mode] || '#888' }}
                          onClick={() => onLineToggle(mode, line)}
                        >
                          {line}
                          <span className="line-chip-remove">&times;</span>
                        </span>
                      );
                    })}
                    <button className="clear-lines-btn" onClick={onClearLines}>
                      Clear all
                    </button>
                  </div>
                )}

                <div className="available-lines">
                  {Object.entries(filteredLineOptions).map(([mode, lines]) => (
                    <div key={mode} className="line-group">
                      <div className="line-group-header">
                        <span
                          className="mode-color-dot"
                          style={{ backgroundColor: MODE_COLOR_MAP[mode] || '#888' }}
                        />
                        {MODE_LABEL_MAP[mode] || mode}
                      </div>
                      <div className="line-group-chips">
                        {lines.map(({ line, count }) => {
                          const key = `${mode}:${line}`;
                          const isSelected = selectedLineSet.has(key);
                          return (
                            <span
                              key={key}
                              className={`line-chip ${isSelected ? 'selected' : ''}`}
                              style={isSelected ? { borderColor: MODE_COLOR_MAP[mode] || '#888' } : {}}
                              onClick={() => onLineToggle(mode, line)}
                              title={`${count} vehicle${count !== 1 ? 's' : ''}`}
                            >
                              {line}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {Object.keys(filteredLineOptions).length === 0 && (
                    <div className="line-no-results">No matching lines</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="actions">
            <button
              className="refresh-btn"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? '⟳ Loading...' : '🔄 Refresh Now'}
            </button>
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="info">
            <small>Updates every {effectiveInterval / 1000}s</small>
          </div>
        </>
      )}
    </div>
  );
}
