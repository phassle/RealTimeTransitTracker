import { useState, useMemo } from 'react';
import './ControlPanel.css';
import { MODES, MODE_COLORS as MODE_COLOR_MAP, MODE_LABELS as MODE_LABEL_MAP } from '../services/modes';

// Display names for webcam source slugs in partial-failure warnings.
const SOURCE_LABELS = {
  trafikverket: 'Trafikverket',
  windy: 'Windy',
  webcamcollections: 'Curated catalogue',
};

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
  isLineSelected = () => false,
  onLineToggle = () => {},
  onClearLines = () => {},
  isLineFavourite = () => false,
  onFavouriteToggle = () => {},
  onClearFavourites = () => {},
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
  webcamsErrors = [],
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
            {webcamsEnabled && !webcamsError && webcamsErrors.length > 0 && (
              <div className="webcam-source-warning" role="status">
                ⚠️ {webcamsErrors.map(e => SOURCE_LABELS[e.source] || e.source).join(', ')}{' '}
                unavailable — other sources shown
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
            {MODES.map(mode => (
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
                    {selectedLines.map(({ mode, line }) => {
                      const favourite = isLineFavourite(mode, line);
                      return (
                        <span
                          key={`${mode}:${line}`}
                          className={`line-chip selected ${favourite ? 'favourite' : ''}`}
                          style={{ borderColor: MODE_COLOR_MAP[mode] || '#888' }}
                          onClick={() => onLineToggle(mode, line)}
                        >
                          {line}
                          {/* Summary-chip star: lets a seeded Favourite whose
                              line has no live vehicle (so no available-line
                              chip) still be unfavourited (PRD #105 story 8). */}
                          <button
                            type="button"
                            className={`line-chip-star ${favourite ? 'favourite' : ''}`}
                            style={{ color: MODE_COLOR_MAP[mode] || '#888' }}
                            aria-pressed={favourite}
                            aria-label={`${favourite ? 'Unfavourite' : 'Favourite'} line ${line}`}
                            title={favourite ? 'Unfavourite line' : 'Favourite line'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onFavouriteToggle(mode, line);
                            }}
                          >
                            {favourite ? '★' : '☆'}
                          </button>
                          <span className="line-chip-remove">&times;</span>
                        </span>
                      );
                    })}
                    <button className="clear-lines-btn" onClick={onClearLines}>
                      Clear all
                    </button>
                    {/* Distinct from "Clear all" (session Selection): wipes
                        persistent pins so the user never erases Favourites
                        when they only meant to clear the filter (story 10). */}
                    <button className="clear-favourites-btn" onClick={onClearFavourites}>
                      ★ Clear favourites
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
                          const selected = isLineSelected(mode, line);
                          const favourite = isLineFavourite(mode, line);
                          return (
                            <span
                              key={`${mode}:${line}`}
                              className={`line-chip ${selected ? 'selected' : ''} ${favourite ? 'favourite' : ''}`}
                              style={selected ? { borderColor: MODE_COLOR_MAP[mode] || '#888' } : {}}
                              onClick={() => onLineToggle(mode, line)}
                              title={`${count} vehicle${count !== 1 ? 's' : ''}`}
                            >
                              {line}
                              <button
                                type="button"
                                className={`line-chip-star ${favourite ? 'favourite' : ''}`}
                                style={{ color: MODE_COLOR_MAP[mode] || '#888' }}
                                aria-pressed={favourite}
                                aria-label={`${favourite ? 'Unfavourite' : 'Favourite'} line ${line}`}
                                title={favourite ? 'Unfavourite line' : 'Favourite line'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFavouriteToggle(mode, line);
                                }}
                              >
                                {favourite ? '★' : '☆'}
                              </button>
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
