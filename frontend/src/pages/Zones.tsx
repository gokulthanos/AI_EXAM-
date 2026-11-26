import { useMemo, useState } from 'react';
import { Edit, Loader2, MapPin, Plus, Search, Trash2, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getErrorMessage } from '../services/api';
import type { ZoneWithStats } from '../types';
import { ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from '../components/ui';

interface ZoneForm {
  zone_name: string;
  zone_description: string;
}

const emptyForm: ZoneForm = { zone_name: '', zone_description: '' };

function ZoneStatus({ zone }: { zone: ZoneWithStats }) {
  if (zone.camera_count === 0) return <span className="badge-gray">No cameras</span>;
  if (zone.active_camera_count > 0) return <span className="badge-green">Active</span>;
  return <span className="badge-amber">Idle</span>;
}

export function Zones() {
  const {
    zones,
    cameras,
    activeDetections,
    loading,
    refreshZones,
    createZone,
    updateZone,
    deleteZone,
    updateCamera,
    notify,
  } = useApp();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneWithStats | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ZoneWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ZoneWithStats | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return zones;
    return zones.filter(
      (zone) =>
        zone.zone_name.toLowerCase().includes(query) ||
        (zone.zone_description ?? '').toLowerCase().includes(query),
    );
  }, [zones, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (zone: ZoneWithStats) => {
    setEditing(zone);
    setForm({ zone_name: zone.zone_name, zone_description: zone.zone_description ?? '' });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.zone_name.trim()) {
      setFormError('Zone name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        zone_name: form.zone_name.trim(),
        zone_description: form.zone_description.trim() || undefined,
      };
      if (editing) {
        await updateZone(editing.id, payload);
        notify('Zone updated', 'success');
      } else {
        await createZone(payload);
        notify('Zone created', 'success');
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save zone'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteZone(deleteTarget.id);
      notify(`Zone "${deleteTarget.zone_name}" deleted`, 'success');
      setDeleteTarget(null);
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to delete zone'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAssignment = async (cameraId: number, currentZoneId: number | null, zoneId: number) => {
    setAssigningId(cameraId);
    try {
      await updateCamera(cameraId, { zone_id: currentZoneId === zoneId ? null : zoneId });
      notify(currentZoneId === zoneId ? 'Camera unassigned from zone' : 'Camera assigned to zone', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to update camera assignment'), 'error');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Zone Management"
        subtitle="Restricted areas covered by the surveillance system"
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Zone
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search zones by name or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-mute">
          <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => void refreshZones()}>
            {loading.zones ? <Spinner /> : <Loader2 className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <span>{filtered.length} of {zones.length} zones</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading.zones && zones.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-mute">
            <Spinner className="h-5 w-5" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-8 w-8" />}
            title={search ? 'No zones match your search' : 'No zones configured'}
            description={
              search ? 'Try a different search term.' : 'Create zones such as Examination Hall A, Library or Main Entrance.'
            }
            action={
              !search ? (
                <button type="button" className="btn-primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Create Zone
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Zone ID</th>
                  <th>Zone</th>
                  <th>Cameras</th>
                  <th>Total Detections</th>
                  <th>Active Detections</th>
                  <th>Pending Review</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((zone) => {
                  const active = activeDetections.filter((session) => session.zone_id === zone.id).length;
                  return (
                    <tr key={zone.id}>
                      <td className="font-mono text-xs text-mute">#{zone.id}</td>
                      <td>
                        <p className="font-medium text-slate-200">{zone.zone_name}</p>
                        <p className="max-w-xs truncate text-xs text-mute">
                          {zone.zone_description || 'No description'}
                        </p>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Video className="h-3.5 w-3.5 text-slate-500" />
                          {zone.camera_count}
                        </span>
                        <span className="ml-2 text-[11px] text-mute">{zone.active_camera_count} online</span>
                      </td>
                      <td className="tabular-nums">{zone.total_detections.toLocaleString()}</td>
                      <td>
                        {active > 0 ? (
                          <span className="badge-red tabular-nums">{active} active</span>
                        ) : (
                          <span className="text-xs text-mute">—</span>
                        )}
                      </td>
                      <td>
                        {zone.pending_reviews > 0 ? (
                          <span className="badge-amber tabular-nums">{zone.pending_reviews}</span>
                        ) : (
                          <span className="text-xs text-mute">—</span>
                        )}
                      </td>
                      <td>
                        <ZoneStatus zone={zone} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs"
                            onClick={() => setAssignTarget(zone)}
                          >
                            Cameras
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Edit zone"
                            onClick={() => openEdit(zone)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon hover:text-danger-400"
                            title="Delete zone"
                            onClick={() => setDeleteTarget(zone)}
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
          title={editing ? 'Edit zone' : 'Create zone'}
          subtitle={editing ? `Zone #${editing.id}` : 'Define a restricted area to group cameras'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="zone-name">
                Zone name
              </label>
              <input
                id="zone-name"
                className="input"
                value={form.zone_name}
                onChange={(event) => setForm({ ...form, zone_name: event.target.value })}
                placeholder="e.g. Examination Hall A"
                maxLength={100}
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="zone-description">
                Description
              </label>
              <textarea
                id="zone-description"
                className="input min-h-[90px] resize-y"
                value={form.zone_description}
                onChange={(event) => setForm({ ...form, zone_description: event.target.value })}
                placeholder="Optional description of the restricted area"
                rows={3}
              />
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
                {editing ? 'Save changes' : 'Create zone'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete zone"
          message={`Delete "${deleteTarget.zone_name}"? Cameras assigned to this zone will become unassigned. Recorded detection events are retained.`}
          confirmLabel="Delete zone"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {assignTarget && (
        <Modal
          title="Assign cameras"
          subtitle={assignTarget.zone_name}
          onClose={() => setAssignTarget(null)}
        >
          {cameras.length === 0 ? (
            <EmptyState icon={<Video className="h-7 w-7" />} title="No cameras registered" />
          ) : (
            <div className="max-h-[60vh] space-y-1 overflow-y-auto scrollbar-thin">
              {cameras.map(({ camera }) => {
                const assigned = camera.zone_id === assignTarget.id;
                return (
                  <label
                    key={camera.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-ink-850"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line bg-ink-850 accent-primary-600"
                      checked={assigned}
                      disabled={assigningId === camera.id}
                      onChange={() => void toggleAssignment(camera.id, camera.zone_id, assignTarget.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-200">{camera.camera_name}</span>
                      <span className="block truncate text-xs text-mute">
                        {camera.camera_source}
                        {camera.zone_id && camera.zone_id !== assignTarget.id
                          ? ' · currently assigned to another zone'
                          : ''}
                      </span>
                    </span>
                    {assigningId === camera.id && <Spinner className="h-3.5 w-3.5 text-mute" />}
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => setAssignTarget(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
