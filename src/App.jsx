import { useState, useMemo } from 'react';
import { Map } from './components/Map';
import { CommandCenter } from './components/CommandCenter';
import { ControlPanel } from './components/ControlPanel';
import { OfflineBanner } from './components/OfflineBanner';
import { UpdateToast } from './components/UpdateToast';
import { PrivacyNotice } from './components/PrivacyNotice';
import { useRealtimeVehicles } from './hooks/useRealtimeVehicles';
import { useFilterSelection } from './hooks/useFilterSelection';
import { useTheme } from './hooks/useTheme';
import { useConnectivity } from './hooks/useConnectivity';
import { useUpdatePrompt } from './hooks/useUpdatePrompt';
import { useWebcams } from './hooks/useWebcams';
import {
  CAMERA_TYPE_DEFINITIONS,
  cameraCountsByType,
  filterCamerasByType,
} from './services/cameraTypeFilter';
import { OPERATORS, OPERATOR_MAP, SWEDEN_CENTER, SWEDEN_ZOOM, getVisibleOperators } from './config/operators';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useConnectivity();
  const { needRefresh, updateServiceWorker, dismissUpdate } = useUpdatePrompt();
  const [mapCenter, setMapCenter] = useState([59.3293, 18.0686]);
  const [mapZoom, setMapZoom] = useState(11);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [view, setView] = useState('map'); // 'map' | 'command' — Command Center is additive (PRD #84)
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

  const { vehicles: allVehicles, feedOutcomes, error, loading, lastUpdate, refresh, activeOperators, effectiveInterval } =
    useRealtimeVehicles(visibleOperators, 2000, isOnline);

  const {
    enabledModes,
    toggleMode,
    selectedLines,
    isLineSelected,
    toggleLine,
    clearLines,
    availableLines,
    filteredVehicles,
  } = useFilterSelection(allVehicles);

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

  const viewToggle = (
    <button
      type="button"
      className="view-toggle"
      onClick={() => setView(v => (v === 'map' ? 'command' : 'map'))}
      style={{
        position: 'absolute', top: 10, left: 10, zIndex: 1000,
        padding: '6px 12px', cursor: 'pointer',
      }}
    >
      {view === 'map' ? 'Open Command Center' : 'Back to map'}
    </button>
  );

  if (view === 'command') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <CommandCenter vehicles={allVehicles} feeds={feedOutcomes} theme={theme} />
        {viewToggle}
        <OfflineBanner isOnline={isOnline} />
        <PrivacyNotice />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {viewToggle}
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
        onModeToggle={toggleMode}
        availableLines={availableLines}
        selectedLines={selectedLines}
        isLineSelected={isLineSelected}
        onLineToggle={toggleLine}
        onClearLines={clearLines}
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
