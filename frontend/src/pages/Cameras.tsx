import { useEffect, useMemo, useState } from 'react';
import {
  Camera as CameraIcon,
  Edit,
  Eye,
  Loader2,
  MonitorStop,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, getErrorMessage } from '../services/api';
import type { CameraPreview, CameraWithStatus, WebcamDevice } from '../types';
import { CameraStatusBadge, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from '../components/ui';
import { percent, relativeTime } from '../utils/format';

interface CameraForm {
  camera_name: string;
  camera_source: string;
  zone_id: string;
}

const emptyForm: CameraForm = { camera_name: '', camera_source: '0', zone_id: '' };

export function Cameras() {
  const {
    cameras,
    zones,
    stats,
    loading,
    refreshCameras,
    createCamera,
    updateCamera,
    deleteCamera,
    connectCamera,
    disconnectCamera,
    startMonitoring,
    stopMonitoring,
    zoneName,
    notify,
  } = useApp();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CameraWithStatus | null>(null);
  const [form, setForm] = useState<CameraForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<WebcamDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CameraWithStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [previewCamera, setPreviewCamera] = useState<CameraWithStatus | null>(null);
  const [preview, setPreview] = useState<CameraPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const detectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    stats?.top_cameras.forEach((entry) => map.set(entry.camera_name, entry.count));
    return map;
  }, [stats]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cameras;
    return cameras.filter(
      ({ camera }) =>
        camera.camera_name.toLowerCase().includes(query) ||
        camera.camera_source.toLowerCase().includes(query),
    );
  }, [cameras, search]);

  // Preview polling while the preview dialog is open
  useEffect(() => {
    if (!previewCamera) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const frame = await api.getCameraPreview(previewCamera.camera.id);
        if (!cancelled) {
          setPreview(frame);
          setPreviewError(null);
        }
      } catch (error) {
        if (!cancelled) setPreviewError(getErrorMessage(error, 'No frame available for this camera'));
      } finally {
        if (!cancelled) timer = setTimeout(tick, 1000);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setPreview(null);
      setPreviewError(null);
    };
  }, [previewCamera]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (entry: CameraWithStatus) => {
    setEditing(entry);
    setForm({
      camera_name: entry.camera.camera_name,
      camera_source: entry.camera.camera_source,
      zone_id: entry.camera.zone_id ? String(entry.camera.zone_id) : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const scanDevices = async () => {
    setScanning(true);
    try {
      const list = await api.getAvailableDevices();
      setDevices(list);
      if (list.length === 0) notify('No webcam devices detected', 'error');
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to scan for webcams'), 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.camera_name.trim() || !form.camera_source.trim()) {
      setFormError('Camera name and source are required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        camera_name: form.camera_name.trim(),
        camera_source: form.camera_source.trim(),
        zone_id: form.zone_id ? Number(form.zone_id) : undefined,
      };
      if (editing) {
        await updateCamera(editing.camera.id, payload);
        notify('Camera updated', 'success');
      } else {
        await createCamera(payload);
        notify('Camera registered', 'success');
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save camera'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: () => Promise<void>, successMessage: string) => {
    setActionId(id);
    try {
      await action();
      notify(successMessage, 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Camera action failed'), 'error');
      await refreshCameras();
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCamera(deleteTarget.camera.id);
      notify(`Camera "${deleteTarget.camera.camera_name}" deleted`, 'success');
      setDeleteTarget(null);
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to delete camera'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Camera Management"
        subtitle="Register cameras, assign zones and control monitoring"
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Register Camera
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search by camera name or source"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-mute">
          <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => void refreshCameras()}>
            {loading.cameras ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh status
          </button>
          <span>{filtered.length} of {cameras.length} cameras</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading.cameras && cameras.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-mute">
            <Spinner className="h-5 w-5" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CameraIcon className="h-8 w-8" />}
            title={search ? 'No cameras match your search' : 'No cameras registered'}
            description={
              search
                ? 'Try a different search term.'
                : 'Register a local webcam by device index or an RTSP/HTTP stream URL.'
            }
            action={
              !search ? (
                <button type="button" className="btn-primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Register Camera
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Camera</th>
                  <th>Zone</th>
                  <th>Status</th>
                  <th>Monitoring</th>
                  <th>Total Detections</th>
                  <th>Last Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const { camera, status } = entry;
                  const isMonitoring = Boolean(status?.is_monitoring);
                  const busy = actionId === camera.id;
                  return (
                    <tr key={camera.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-ink-750 text-slate-400">
                            <Video className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-200">{camera.camera_name}</p>
                            <p className="truncate font-mono text-[11px] text-mute">
                              #{camera.id} · {camera.camera_source}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-mute">{zoneName(camera.zone_id)}</td>
                      <td>
                        <CameraStatusBadge status={status?.status ?? camera.status} monitoring={isMonitoring} />
                        {status?.error_message && (
                          <p className="mt-1 max-w-[220px] truncate text-[11px] text-danger-400" title={status.error_message}>
                            {status.error_message}
                          </p>
                        )}
                      </td>
                      <td className="tabular-nums text-xs">
                        {isMonitoring ? (
                          <span className="text-success-400">
                            {status?.current_fps !== null && status?.current_fps !== undefined
                              ? `${status.current_fps.toFixed(1)} FPS`
                              : 'Live'}
                          </span>
                        ) : (
                          <span className="text-mute">Stopped</span>
                        )}
                      </td>
                      <td className="tabular-nums">{(detectionCounts.get(camera.camera_name) ?? 0).toLocaleString()}</td>
                      <td className="text-xs text-mute">
                        {status?.last_frame_time ? relativeTime(status.last_frame_time) : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {isMonitoring ? (
                            <button
                              type="button"
                              className="btn-danger px-2 py-1 text-xs"
                              disabled={busy}
                              onClick={() =>
                                void runAction(camera.id, () => stopMonitoring(camera.id), 'Monitoring stopped')
                              }
                            >
                              {busy ? <Spinner className="h-3 w-3" /> : <MonitorStop className="h-3 w-3" />}
                              Stop
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-success px-2 py-1 text-xs"
                              disabled={busy}
                              onClick={() =>
                                void runAction(camera.id, () => startMonitoring(camera.id), 'Monitoring started')
                              }
                            >
                              {busy ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              Start
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-icon"
                            title="Preview"
                            onClick={() => setPreviewCamera(entry)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title={status?.status === 'active' ? 'Disconnect camera' : 'Connect camera'}
                            onClick={() =>
                              void runAction(
                                camera.id,
                                () =>
                                  status?.status === 'active'
                                    ? disconnectCamera(camera.id)
                                    : connectCamera(camera.id),
                                status?.status === 'active' ? 'Camera disconnected' : 'Camera connected',
                              )
                            }
                            disabled={busy}
                          >
                            {status?.status === 'active' ? (
                              <WifiOff className="h-3.5 w-3.5" />
                            ) : (
                              <Wifi className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Edit camera"
                            onClick={() => openEdit(entry)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon hover:text-danger-400"
                            title="Delete camera"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? 'Edit camera' : 'Register camera'}
          subtitle={editing ? `Camera #${editing.camera.id}` : 'Local webcam index or network stream URL'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="camera-name">
                Camera name
              </label>
              <input
                id="camera-name"
                className="input"
                value={form.camera_name}
                onChange={(event) => setForm({ ...form, camera_name: event.target.value })}
                placeholder="e.g. Examination Hall Entrance"
                maxLength={100}
                autoFocus
              />
            </div>
            <div>
              <div className="flex items-end justify-between gap-2">
                <label className="label mb-0" htmlFor="camera-source">
                  Webcam index or stream URL
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary-400 hover:text-primary-300"
                  onClick={scanDevices}
                  disabled={scanning}
                >
                  {scanning ? 'Scanning…' : 'Scan webcams'}
                </button>
              </div>
              <input
                id="camera-source"
                className="input mt-1.5 font-mono"
                value={form.camera_source}
                onChange={(event) => setForm({ ...form, camera_source: event.target.value })}
                placeholder="0, rtsp://…, http://…"
              />
              <p className="mt-1 text-xs text-mute">
                Device index (0, 1, …), RTSP URL, HTTP/MJPEG stream or video file path.
              </p>
              {devices.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {devices.map((device) => (
                    <button
                      key={device.index}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs transition-colors ${
                        form.camera_source === device.source
                          ? 'border-primary-500/50 bg-primary-500/10 text-primary-300'
                          : 'border-line bg-ink-850 text-slate-400 hover:text-slate-200'
                      }`}
                      onClick={() =>
                        setForm({
                          ...form,
                          camera_source: device.source,
                          camera_name: form.camera_name || device.label,
                        })
                      }
                    >
                      {device.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label" htmlFor="camera-zone">
                Assigned zone
              </label>
              <select
                id="camera-zone"
                className="input"
                value={form.zone_id}
                onChange={(event) => setForm({ ...form, zone_id: event.target.value })}
              >
                <option value="">No zone</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.zone_name}
                  </option>
                ))}
              </select>
            </div>
            {formError && (
              <p className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-300">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving && <Spinner />}
                {editing ? 'Save changes' : 'Register camera'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete camera"
          message={`Delete "${deleteTarget.camera.camera_name}"? Its detection events will also be removed. This cannot be undone.`}
          confirmLabel="Delete camera"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {previewCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-line bg-ink-900">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{previewCamera.camera.camera_name}</p>
                <p className="text-xs text-mute">
                  {zoneName(previewCamera.camera.zone_id)} ·{' '}
                  {previewCamera.status?.is_monitoring ? 'Monitoring' : 'Not monitoring'}
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setPreviewCamera(null)} aria-label="Close preview">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative flex aspect-video items-center justify-center bg-black">
              {preview?.frame_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${preview.frame_base64}`}
                  alt={`Preview from ${previewCamera.camera.camera_name}`}
                  className="h-full w-full object-contain"
                />
              ) : previewError ? (
                <div className="px-6 text-center">
                  <Video className="mx-auto h-10 w-10 text-slate-600" />
                  <p className="mt-3 text-sm text-slate-300">No preview available</p>
                  <p className="mt-1 text-xs text-mute">{previewError}</p>
                  <p className="mt-2 text-xs text-mute">Start monitoring this camera to receive frames.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-mute">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Loading preview…</span>
                </div>
              )}
              {preview?.detections && preview.detections.length > 0 && (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                  {preview.detections.map((detection, index) => (
                    <span key={index} className="badge-red font-mono">
                      {detection.class_name} {percent(detection.confidence, 1)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-mute">
              <span>Preview refreshes every second from `/cameras/{'{id}'}/preview`.</span>
              {previewCamera.status?.current_fps !== null && previewCamera.status?.current_fps !== undefined && (
                <span className="tabular-nums">{previewCamera.status.current_fps.toFixed(1)} FPS</span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
