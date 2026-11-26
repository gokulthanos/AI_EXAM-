import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera as CameraIcon,
  CameraOff,
  Clock,
  Crosshair,
  MapPin,
  MonitorStop,
  Play,
  Radar,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Square,
  Video,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, getErrorMessage } from '../services/api';
import type { CameraPreview, DetectionEventWithDetails, WebcamDevice } from '../types';
import { CameraStatusBadge, EmptyState, PageHeader, Spinner } from '../components/ui';
import { formatDuration, formatTime, percent, relativeTime } from '../utils/format';

export function LiveMonitoring() {
  const {
    cameras,
    zones,
    activeDetections,
    alerts,
    startMonitoring,
    stopMonitoring,
    createCamera,
    refreshCameras,
    cameraName,
    zoneName,
    notify,
  } = useApp();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<CameraPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [savedEvents, setSavedEvents] = useState<DetectionEventWithDetails[]>([]);

  const [devices, setDevices] = useState<WebcamDevice[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [deviceZone, setDeviceZone] = useState('');

  const selected = cameras.find((entry) => entry.camera.id === selectedId) ?? null;
  const monitoring = Boolean(selected?.status?.is_monitoring);

  useEffect(() => {
    if (selectedId === null && cameras.length > 0) setSelectedId(cameras[0].camera.id);
  }, [cameras, selectedId]);

  const activeSession = activeDetections.find((session) => session.camera_id === selectedId) ?? null;

  // 1s ticker for the live detection duration
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll the backend preview endpoint while monitoring. Each frame is run
  // through YOLO by the backend, which is what drives detection sessions.
  useEffect(() => {
    if (selectedId === null || !monitoring) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const frame = await api.getCameraPreview(selectedId);
        if (!cancelled) {
          setPreview(frame);
          setPreviewError(null);
        }
      } catch (error) {
        if (!cancelled) setPreviewError(getErrorMessage(error, 'No frame available from camera'));
      } finally {
        if (!cancelled) timer = setTimeout(tick, 900);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedId, monitoring]);

  const endedAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.event_type === 'ended' && alert.camera_id === selectedId)
        .slice(0, 5),
    [alerts, selectedId],
  );

  const loadSavedEvents = useCallback(
    async (cameraId: number) => {
      try {
        const response = await api.getDetectionEvents({ camera_id: cameraId, page_size: 5 });
        setSavedEvents(response.items);
      } catch {
        setSavedEvents([]);
      }
    },
    [],
  );

  const endedCount = endedAlerts.length;

  useEffect(() => {
    if (selectedId === null) {
      setSavedEvents([]);
      return;
    }
    void loadSavedEvents(selectedId);
  }, [selectedId, endedCount, loadSavedEvents]);

  const handleStart = async () => {
    if (selectedId === null) {
      notify('Select a camera before starting monitoring', 'error');
      return;
    }
    setBusy(true);
    try {
      await startMonitoring(selectedId);
      notify('Monitoring started', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to start monitoring'), 'error');
      await refreshCameras();
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    if (selectedId === null) return;
    setBusy(true);
    try {
      await stopMonitoring(selectedId);
      setPreview(null);
      notify('Monitoring stopped', 'info');
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to stop monitoring'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const discoverDevices = async () => {
    setDeviceLoading(true);
    try {
      const list = await api.getAvailableDevices();
      setDevices(list);
      setSelectedDevice(list[0]?.source ?? '');
      if (list.length === 0) {
        notify('No webcam devices were detected by the backend', 'error');
      }
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to scan for webcam devices'), 'error');
    } finally {
      setDeviceLoading(false);
    }
  };

  const registerAndStart = async () => {
    if (!selectedDevice) {
      notify('Select a webcam device first', 'error');
      return;
    }
    setBusy(true);
    try {
      const existing = cameras.find((entry) => entry.camera.camera_source === selectedDevice);
      const camera =
        existing?.camera ??
        (await createCamera({
          camera_name: `Webcam ${selectedDevice}`,
          camera_source: selectedDevice,
          zone_id: deviceZone ? Number(deviceZone) : undefined,
        }));
      setSelectedId(camera.id);
      await startMonitoring(camera.id);
      notify(`Webcam ${selectedDevice} is now monitoring`, 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to register webcam'), 'error');
      await refreshCameras();
    } finally {
      setBusy(false);
    }
  };

  const duration = activeSession
    ? Math.max(0, Math.floor((now - new Date(activeSession.start_time).getTime()) / 1000))
    : 0;

  const previewDetections = preview?.detections ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Live Monitoring"
        subtitle="Real-time camera feed, bounding boxes and mobile phone alerts"
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border border-line bg-ink-900 px-2 py-1.5">
              <CameraIcon className="ml-1 h-3.5 w-3.5 text-mute" />
              <select
                className="min-w-[150px] max-w-[220px] bg-transparent pr-1 text-sm text-slate-200 focus:outline-none"
                value={selectedId ?? ''}
                onChange={(event) => {
                  setSelectedId(event.target.value ? Number(event.target.value) : null);
                  setPreview(null);
                  setPreviewError(null);
                }}
              >
                <option value="">Select camera</option>
                {cameras.map(({ camera }) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.camera_name}
                  </option>
                ))}
              </select>
            </div>
            {monitoring ? (
              <button type="button" className="btn-danger" onClick={handleStop} disabled={busy}>
                {busy ? <Spinner /> : <Square className="h-4 w-4" />}
                Stop Monitoring
              </button>
            ) : (
              <button
                type="button"
                className="btn-success"
                onClick={handleStart}
                disabled={busy || selectedId === null}
              >
                {busy ? <Spinner /> : <Play className="h-4 w-4" />}
                Start Monitoring
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        {/* Camera feed */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-750 text-slate-400">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  {selected ? selected.camera.camera_name : 'No camera selected'}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-mute">
                  <MapPin className="h-3 w-3" />
                  {selected ? zoneName(selected.camera.zone_id) : 'Assign a camera to a zone'}
                  {selected && <span className="text-slate-600">·</span>}
                  {selected && <span className="font-mono text-[11px]">{selected.camera.camera_source}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected?.status?.current_fps !== null && selected?.status?.current_fps !== undefined && (
                <span className="badge-gray tabular-nums">{selected.status.current_fps.toFixed(1)} FPS</span>
              )}
              {selected && (
                <CameraStatusBadge
                  status={selected.status?.status ?? selected.camera.status}
                  monitoring={monitoring}
                />
              )}
            </div>
          </div>

          <div className="relative aspect-video w-full bg-black">
            {preview?.frame_base64 ? (
              <img
                src={`data:image/jpeg;base64,${preview.frame_base64}`}
                alt={`Live feed from ${selected?.camera.camera_name ?? 'camera'}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                {monitoring ? (
                  <>
                    {previewError ? (
                      <>
                        <CameraOff className="h-10 w-10 text-slate-600" />
                        <p className="text-sm font-medium text-slate-300">Unable to read camera frames</p>
                        <p className="max-w-md text-xs text-mute">{previewError}</p>
                      </>
                    ) : (
                      <>
                        <Spinner className="h-7 w-7 text-primary-400" />
                        <p className="text-sm text-slate-300">Waiting for the first frame…</p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Radar className="h-10 w-10 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">
                      {selectedId === null ? 'Select or register a camera' : 'Monitoring is stopped'}
                    </p>
                    <p className="max-w-md text-xs text-mute">
                      {selectedId === null
                        ? 'Choose a registered camera above, or discover a local webcam below.'
                        : 'Start monitoring to stream frames and run YOLO mobile phone detection.'}
                    </p>
                  </>
                )}
              </div>
            )}

            {monitoring && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-black/65 px-2 py-1 text-[11px] font-semibold tracking-wide text-danger-300 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-400 opacity-80" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger-400" />
                </span>
                LIVE
              </div>
            )}
            {preview && (
              <div className="absolute right-3 top-3 rounded bg-black/65 px-2 py-1 font-mono text-[11px] text-slate-300 backdrop-blur">
                {formatTime(preview.timestamp)}
              </div>
            )}
            {activeSession && (
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded border border-danger-500/50 bg-black/70 px-3 py-2 backdrop-blur">
                <Smartphone className="h-4 w-4 text-danger-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-danger-300">Mobile Phone</span>
                <span className="text-xs tabular-nums text-slate-200">{percent(activeSession.max_confidence)}</span>
                <span className="text-xs tabular-nums text-slate-400">{formatDuration(duration)}</span>
                <span className="ml-auto text-[11px] text-slate-400">Active detection</span>
              </div>
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-mute">
                Detections in current frame
              </p>
              <span className="text-[11px] text-mute">{previewDetections.length} object(s)</span>
            </div>
            {previewDetections.length === 0 ? (
              <p className="mt-2 text-xs text-mute">
                {monitoring ? 'No mobile phone detected in the latest processed frame.' : 'Monitoring stopped.'}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {previewDetections.map((detection, index) => (
                  <span
                    key={`${detection.class_name}-${index}`}
                    className="badge-red gap-1.5 font-mono text-[11px]"
                  >
                    {detection.class_name} · {percent(detection.confidence, 1)}
                  </span>
                ))}
              </div>
            )}
            {selected?.status?.error_message && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {selected.status.error_message}
              </p>
            )}
          </div>
        </div>

        {/* Detection information */}
        <div className="space-y-5">
          <div className={`card ${activeSession ? 'border-danger-500/40' : ''}`}>
            <div className="card-header">
              <div className="flex items-center gap-2">
                {activeSession ? (
                  <AlertTriangle className="h-4 w-4 text-danger-400" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-success-400" />
                )}
                <h2 className="card-title">{activeSession ? 'Detection Active' : 'Detection Status'}</h2>
              </div>
              <span className={activeSession ? 'badge-red' : 'badge-green'}>
                {activeSession ? 'Active' : 'Clear'}
              </span>
            </div>

            {activeSession ? (
              <div className="animate-fade-in divide-y divide-line/70">
                <dl className="space-y-2.5 px-5 py-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Object</dt>
                    <dd className="font-medium text-danger-300">Mobile Phone</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Camera</dt>
                    <dd className="text-right font-medium text-slate-200">{cameraName(activeSession.camera_id)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Zone</dt>
                    <dd className="text-right font-medium text-slate-200">{zoneName(activeSession.zone_id)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Confidence</dt>
                    <dd className="font-mono text-lg font-semibold text-danger-300">
                      {percent(activeSession.max_confidence)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Duration</dt>
                    <dd className="flex items-center gap-1.5 font-mono text-lg font-semibold text-slate-100">
                      <Clock className="h-4 w-4 text-mute" />
                      {formatDuration(duration)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Start time</dt>
                    <dd className="tabular-nums text-slate-200">{formatTime(activeSession.start_time)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Frames detected</dt>
                    <dd className="tabular-nums text-slate-200">{activeSession.detection_count}</dd>
                  </div>
                </dl>
                <div className="px-5 py-3 text-[11px] leading-relaxed text-mute">
                  Detection is provisional. A human administrator must review the recorded event before any action
                  is taken.
                </div>
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-success-500/70" />
                <p className="mt-3 text-sm font-medium text-slate-300">No mobile phone detected</p>
                <p className="mt-1 text-xs text-mute">
                  {monitoring
                    ? 'Monitoring is active. Alerts appear here as soon as YOLO detects a phone.'
                    : 'Start monitoring to receive live detection alerts.'}
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Completed detections</h2>
                <p className="text-xs text-mute">Ended sessions for this camera</p>
              </div>
              {selectedId !== null && (
                <button
                  type="button"
                  className="btn-icon"
                  title="Refresh"
                  onClick={() => void loadSavedEvents(selectedId)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {endedAlerts.length === 0 && savedEvents.length === 0 ? (
              <EmptyState icon={<Smartphone className="h-6 w-6" />} title="No completed detections yet" />
            ) : (
              <div className="divide-y divide-line/70">
                {endedAlerts.map((alert) => (
                  <div key={`${alert.session_id}-${alert.timestamp}`} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-200">Mobile Phone</span>
                      <span className="text-xs tabular-nums text-mute">{percent(alert.confidence)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mute">
                      <span className="tabular-nums">{formatDuration(alert.duration_seconds)}</span>
                      <span>Ended {formatTime(alert.timestamp)}</span>
                      <span>{cameraName(alert.camera_id)}</span>
                    </div>
                  </div>
                ))}
                {endedAlerts.length === 0 &&
                  savedEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-200">{event.detected_object}</span>
                      <span className="text-xs tabular-nums text-mute">{percent(event.confidence)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mute">
                      <span className="tabular-nums">{formatDuration(event.duration_seconds)}</span>
                      <span>{relativeTime(event.start_time)}</span>
                      <span className="font-mono">#{event.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary-400" />
              <h2 className="card-title">Registered cameras</h2>
            </div>
            <span className="text-xs text-mute">{cameras.length} total</span>
          </div>
          {cameras.length === 0 ? (
            <EmptyState
              icon={<CameraIcon className="h-7 w-7" />}
              title="No cameras registered"
              description="Register a webcam or stream from Camera Management to begin monitoring."
            />
          ) : (
            <div className="divide-y divide-line/70">
              {cameras.map(({ camera, status }) => (
                <div
                  key={camera.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${
                    camera.id === selectedId ? 'bg-ink-850/80' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelectedId(camera.id);
                      setPreview(null);
                      setPreviewError(null);
                    }}
                  >
                    <p className="truncate text-sm font-medium text-slate-200">{camera.camera_name}</p>
                    <p className="truncate text-xs text-mute">
                      {zoneName(camera.zone_id)} · {camera.camera_source}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <CameraStatusBadge status={status?.status ?? camera.status} monitoring={status?.is_monitoring} />
                    {status?.is_monitoring ? (
                      <button
                        type="button"
                        className="btn-icon text-danger-400"
                        title="Stop monitoring"
                        onClick={async () => {
                          try {
                            await stopMonitoring(camera.id);
                          } catch (error) {
                            notify(getErrorMessage(error, 'Failed to stop monitoring'), 'error');
                          }
                        }}
                      >
                        <MonitorStop className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-icon text-success-400"
                        title="Start monitoring"
                        onClick={async () => {
                          setSelectedId(camera.id);
                          try {
                            await startMonitoring(camera.id);
                            notify('Monitoring started', 'success');
                          } catch (error) {
                            notify(getErrorMessage(error, 'Failed to start monitoring'), 'error');
                          }
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary-400" />
              <h2 className="card-title">Local webcam discovery</h2>
            </div>
            <button type="button" className="btn-secondary py-1.5 text-xs" onClick={discoverDevices} disabled={deviceLoading}>
              {deviceLoading ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
              Scan devices
            </button>
          </div>
          <div className="card-body space-y-4">
            <p className="text-xs leading-relaxed text-mute">
              The backend probes local device indices (0–4) with OpenCV. Registering a detected webcam starts
              real YOLO monitoring on that device.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="webcam-device">
                  Available webcam
                </label>
                <select
                  id="webcam-device"
                  className="input"
                  value={selectedDevice}
                  onChange={(event) => setSelectedDevice(event.target.value)}
                  disabled={devices.length === 0}
                >
                  <option value="">{devices.length === 0 ? 'Run a scan first' : 'Select device'}</option>
                  {devices.map((device) => (
                    <option key={device.index} value={device.source}>
                      {device.label} (index {device.index})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="webcam-zone">
                  Assign zone
                </label>
                <select
                  id="webcam-zone"
                  className="input"
                  value={deviceZone}
                  onChange={(event) => setDeviceZone(event.target.value)}
                >
                  <option value="">No zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.zone_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={registerAndStart}
                disabled={busy || !selectedDevice}
              >
                {busy ? <Spinner /> : <Play className="h-4 w-4" />}
                Register &amp; Start
              </button>
              <span className="text-xs text-mute">{devices.length} device(s) detected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
