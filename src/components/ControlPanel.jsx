import { useState, useMemo } from 'react';
import './ControlPanel.css';

const TRANSPORT_MODES = [
  { id: 'metro', label: 'Metro', color: '#FF6B35' },
  { id: 'bus', label: 'Bus', color: '#4ECDC4' },
  { id: 'train', label: 'Train', color: '#95E1D3' },
  { id: 'tram', label: 'Tram', color: '#F38181' },
  { id: 'ship', label: 'Ship', color: '#AA96DA' },
  { id: 'ferry', label: 'Ferry', color: '#FCBAD3' },
  { id: 'unknown', label: 'Other', color: '#888888' },
];

const MODE_COLOR_MAP = Object.fromEntries(TRANSPORT_MODES.map(m => [m.id, m.color]));
const MODE_LABEL_MAP = Object.fromEntries(TRANSPORT_MODES.map(m => [m.id, m.label]));

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
  onClearLines = () => {}
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
        <h2>Stockholm Real-Time Transit</h2>
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
          <div className="stats">
            <div className="stat-item">
              <span className="stat-label">Total vehicles:</span>
              <span className="stat-value">{totalVisible}</span>
            </div>
            {lastUpdate && (
              <div className="stat-item">
                <span className="stat-label">Last update:</span>
                <span className="stat-value">{lastUpdate.toLocaleTimeString('sv-SE')}</span>
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
            <small>Updates every 2 seconds</small>
          </div>
        </>
      )}
    </div>
  );
}
