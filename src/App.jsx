import { useState, useMemo } from 'react';
import { Map } from './components/Map';
import { ControlPanel } from './components/ControlPanel';
import { OfflineBanner } from './components/OfflineBanner';
import { UpdateToast } from './components/UpdateToast';
import { PrivacyNotice } from './components/PrivacyNotice';
import { useRealtimeVehicles } from './hooks/useRealtimeVehicles';
import { useTheme } from './hooks/useTheme';
import { useConnectivity } from './hooks/useConnectivity';
import { useUpdatePrompt } from './hooks/useUpdatePrompt';
import { useWebcams } from './hooks/useWebcams';
import {
  CAMERA_TYPE_DEFINITIONS,
  cameraCountsByType,
  filterCamerasByType,
} from './services/cameraTypeFilter';
import { ALL_MODE_IDS } from './services/modes';
import { OPERATORS, OPERATOR_MAP, SWEDEN_CENTER, SWEDEN_ZOOM, getVisibleOperators } from './config/operators';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useConnectivity();
  const { needRefresh, updateServiceWorker, dismissUpdate } = useUpdatePrompt();
  const [enabledModes, setEnabledModes] = useState(ALL_MODE_IDS);
  const [selectedLines, setSelectedLines] = useState([]);
  const [mapCenter, setMapCenter] = useState([59.3293, 18.0686]);
  const [mapZoom, setMapZoom] = useState(11);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [webcamsEnabled, setWebcamsEnabled] = useState(false);
  const [enabledCameraTypes, setEnabledCameraTypes] = useState(
    CAMERA_TYPE_DEFINITIONS.map(t => t.id),
  );

  const { cameras, error: webcamsError, loading: webcamsLoading } = useWebcams(webcamsEnabled);

  const cameraCounts = useMemo(() => cameraCountsByType(cameras), [cameras]);
  const filteredCameras = useMemo(
    () => filterCamerasByType(cameras, enabledCameraTypes),
    [cameras, enabledCameraTypes],
  );

  const visibleOperators = useMemo(() => {
    if (!viewportBounds) return ['sl'];
    return getVisibleOperators(viewportBounds);
  }, [viewportBounds]);

  const { vehicles: allVehicles, error, loading, lastUpdate, refresh, activeOperators, effectiveInterval } =
    useRealtimeVehicles(visibleOperators, 2000, isOnline);

  // Build available lines grouped by mode, only from enabled modes
  const availableLines = useMemo(() => {
    if (!allVehicles || !Array.isArray(allVehicles)) return {};
    const groups = {};
    for (const v of allVehicles) {
      if (!enabledModes.includes(v.mode) || !v.line) continue;
      if (!groups[v.mode]) groups[v.mode] = {};
      if (!groups[v.mode][v.line]) groups[v.mode][v.line] = 0;
      groups[v.mode][v.line]++;
    }
    // Sort lines numerically within each mode
    const sorted = {};
    for (const mode of Object.keys(groups).sort()) {
      sorted[mode] = Object.entries(groups[mode])
        .sort((a, b) => {
          const na = parseInt(a[0], 10);
          const nb = parseInt(b[0], 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a[0].localeCompare(b[0]);
        })
        .map(([line, count]) => ({ line, count }));
    }
    return sorted;
  }, [allVehicles, enabledModes]);

  // Filter vehicles by enabled modes, then by selected lines
  const filteredVehicles = useMemo(() => {
    if (!allVehicles || !Array.isArray(allVehicles)) return [];
    let filtered = allVehicles.filter(v => enabledModes.includes(v.mode));
    if (selectedLines.length > 0) {
      const lineSet = new Set(selectedLines);
      filtered = filtered.filter(v => lineSet.has(`${v.mode}:${v.line}`));
    }
    return filtered;
  }, [allVehicles, enabledModes, selectedLines]);

  const handleModeToggle = (mode) => {
    setEnabledModes(prev => {
      const disabling = prev.includes(mode);
      if (disabling) {
        // Remove selected lines belonging to the disabled mode
        setSelectedLines(sl => sl.filter(key => !key.startsWith(`${mode}:`)));
      }
      return disabling ? prev.filter(m => m !== mode) : [...prev, mode];
    });
  };

  const handleLineToggle = (mode, line) => {
    const key = `${mode}:${line}`;
    setSelectedLines(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleClearLines = () => {
    setSelectedLines([]);
  };

  const handleBoundsChange = (bounds) => {
    setViewportBounds(bounds);
  };

  const handleCameraTypeToggle = (typeId) => {
    setEnabledCameraTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId],
    );
  };

  const handleRegionSelect = (slug) => {
    if (slug === null) {
      setMapCenter(SWEDEN_CENTER);
      setMapZoom(SWEDEN_ZOOM);
    } else {
      const op = OPERATOR_MAP.get(slug);
      if (op) {
        setMapCenter(op.center);
        setMapZoom(10);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        vehicles={filteredVehicles}
        cameras={webcamsEnabled ? filteredCameras : []}
        center={mapCenter}
        zoom={mapZoom}
        onBoundsChange={handleBoundsChange}
        theme={theme}
      />
      <ControlPanel
        vehicles={filteredVehicles}
        loading={loading}
        error={error}
        lastUpdate={lastUpdate}
        onRefresh={refresh}
        enabledModes={enabledModes}
        onModeToggle={handleModeToggle}
        availableLines={availableLines}
        selectedLines={selectedLines}
        onLineToggle={handleLineToggle}
        onClearLines={handleClearLines}
        operators={OPERATORS}
        activeOperators={activeOperators}
        onRegionSelect={handleRegionSelect}
        effectiveInterval={effectiveInterval}
        theme={theme}
        onToggleTheme={toggleTheme}
        webcamsEnabled={webcamsEnabled}
        onWebcamsToggle={() => setWebcamsEnabled(v => !v)}
        webcamsLoading={webcamsLoading}
        webcamsError={webcamsError}
        webcamCount={filteredCameras.length}
        cameraTypeDefinitions={CAMERA_TYPE_DEFINITIONS}
        enabledCameraTypes={enabledCameraTypes}
        cameraCounts={cameraCounts}
        onCameraTypeToggle={handleCameraTypeToggle}
      />
      <OfflineBanner isOnline={isOnline} />
      <UpdateToast isVisible={needRefresh} onReload={updateServiceWorker} onDismiss={dismissUpdate} />
      <PrivacyNotice />
    </div>
  );
}

export default App;
