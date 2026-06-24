import { useState, useMemo, useEffect } from 'react';
import { Map } from './components/Map';
import { CommandCenter } from './components/CommandCenter';
import { ControlPanel } from './components/ControlPanel';
// PROTOTYPE — fancy-interface variants, dev-only. Remove with src/components/prototype/. See NOTES.md.
import { FancyControlPanel } from './components/prototype/FancyControlPanel';
const PanelComponent = import.meta.env.DEV ? FancyControlPanel : ControlPanel;
import { LocateControl } from './components/LocateControl';
import { OfflineBanner } from './components/OfflineBanner';
import { UpdateToast } from './components/UpdateToast';
import { PrivacyNotice } from './components/PrivacyNotice';
import { useRealtimeVehicles } from './hooks/useRealtimeVehicles';
import { useFilterSelection } from './hooks/useFilterSelection';
import { useTheme } from './hooks/useTheme';
import { useConnectivity } from './hooks/useConnectivity';
import { useGeolocation } from './hooks/useGeolocation';
import { useUpdatePrompt } from './hooks/useUpdatePrompt';
import { useWebcams } from './hooks/useWebcams';
import { useAircraft } from './hooks/useAircraft';
import {
  CAMERA_TYPE_DEFINITIONS,
  cameraCountsByType,
  filterCamerasByType,
} from './services/cameraTypeFilter';
import { OPERATORS, OPERATOR_MAP, SWEDEN_CENTER, SWEDEN_ZOOM, getVisibleOperators } from './config/operators';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useConnectivity();
  const { locate, position: userLocation, status: geolocationStatus } = useGeolocation();
  const { needRefresh, updateServiceWorker, dismissUpdate } = useUpdatePrompt();
  const [mapCenter, setMapCenter] = useState([59.3293, 18.0686]);
  const [mapZoom, setMapZoom] = useState(11);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [view, setView] = useState('map'); // 'map' | 'command' — Command Center is additive (PRD #84)
  const [webcamsEnabled, setWebcamsEnabled] = useState(false);
  const [enabledCameraTypes, setEnabledCameraTypes] = useState(
    CAMERA_TYPE_DEFINITIONS.map(t => t.id),
  );

  // Fly to the User location when a fix arrives, at city-level zoom (~12).
  // This reuses the existing center/zoom → Map flyTo seam; moving the viewport
  // also triggers the viewport→operators fetch, so the user's region loads
  // its vehicles with no geolocation-specific polling code (PRD #111).
  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.latitude, userLocation.longitude]);
      setMapZoom(12);
    }
  }, [userLocation]);

  const { cameras, error: webcamsError, errors: webcamsErrors, loading: webcamsLoading } = useWebcams(webcamsEnabled);

  const cameraCounts = useMemo(() => cameraCountsByType(cameras), [cameras]);
  const filteredCameras = useMemo(
    () => filterCamerasByType(cameras, enabledCameraTypes),
    [cameras, enabledCameraTypes],
  );

  // ponytail: trivial derivation, no memo needed
  const visibleOperators = viewportBounds ? getVisibleOperators(viewportBounds) : ['sl'];

  const { vehicles: allVehicles, feedOutcomes, error, loading, lastUpdate, refresh, activeOperators, effectiveInterval } =
    useRealtimeVehicles(visibleOperators, 2000, isOnline);

  // Live aircraft overlay (PRD #165). Fetched on a fixed ~2 s cadence around the
  // current viewport centre with a sane default radius (the zoom gate and
  // viewport-radius derivation are a follow-up slice). Merged into the map's
  // Vehicle list below — but deliberately kept OUT of the Command Center, which
  // only ever sees transit Vehicles.
  const aircraftQuery = useMemo(
    () => ({ lat: mapCenter[0], lon: mapCenter[1], radius: 100 }),
    [mapCenter],
  );
  const { aircraft } = useAircraft(aircraftQuery, { enabled: isOnline });

  // Map Vehicle list = transit Vehicles ⧺ aircraft Vehicles.
  const mapVehicles = useMemo(() => [...allVehicles, ...aircraft], [allVehicles, aircraft]);

  const {
    enabledModes,
    toggleMode,
    selectedLines,
    isLineSelected,
    toggleLine,
    clearLines,
    isLineFavourite,
    toggleFavourite,
    clearFavourites,
    availableLines,
    filteredVehicles,
  } = useFilterSelection(mapVehicles);

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
        onBoundsChange={setViewportBounds}
        theme={theme}
        userLocation={userLocation}
      />
      <PanelComponent
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
        isLineFavourite={isLineFavourite}
        onFavouriteToggle={toggleFavourite}
        onClearFavourites={clearFavourites}
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
        webcamsErrors={webcamsErrors}
        webcamCount={filteredCameras.length}
        cameraTypeDefinitions={CAMERA_TYPE_DEFINITIONS}
        enabledCameraTypes={enabledCameraTypes}
        cameraCounts={cameraCounts}
        onCameraTypeToggle={handleCameraTypeToggle}
      />
      <LocateControl status={geolocationStatus} onLocate={locate} theme={theme} />
      <OfflineBanner isOnline={isOnline} />
      <UpdateToast isVisible={needRefresh} onReload={updateServiceWorker} onDismiss={dismissUpdate} />
      <PrivacyNotice />
    </div>
  );
}

export default App;
