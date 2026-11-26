import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Loader2,
  Filter,
  X,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import type { ReviewStatus, DetectionEventWithDetails } from '../types';

export function DetectionEvents() {
  const {
    detectionEvents,
    detectionEventsLoading,
    loadDetectionEvents,
    refreshStats,
    updateReviewStatus,
    deleteDetectionEvent,
    exportDetectionEventsCsv,
    cameras,
    zones,
  } = useApp();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState({
    camera_id: '',
    zone_id: '',
    review_status: '',
    start_date: '',
    end_date: '',
    min_confidence: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<DetectionEventWithDetails | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load data on mount and when filters/page change
  useEffect(() => {
    loadDetectionEvents({
      page,
      page_size: pageSize,
      camera_id: filters.camera_id || undefined,
      zone_id: filters.zone_id || undefined,
      review_status: filters.review_status as ReviewStatus || undefined,
      start_date: filters.start_date || undefined,
      end_date: filters.end_date || undefined,
      min_confidence: filters.min_confidence ? parseFloat(filters.min_confidence) : undefined,
    });
    refreshStats();
  }, [page, pageSize, filters, loadDetectionEvents, refreshStats]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      camera_id: '',
      zone_id: '',
      review_status: '',
      start_date: '',
      end_date: '',
      min_confidence: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const handleReview = async (id: number, status: ReviewStatus) => {
    try {
      await updateReviewStatus(id, status);
    } catch (error) {
      console.error('Failed to update review status:', error);
      alert('Failed to update review status');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this detection event?')) {
      setDeletingId(id);
      try {
        await deleteDetectionEvent(id);
      } catch (error) {
        console.error('Failed to delete:', error);
        alert('Failed to delete detection event');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleExport = async () => {
    try {
      await exportDetectionEventsCsv(filters);
    } catch (error) {
      console.error('Failed to export:', error);
      alert('Failed to export CSV');
    }
  };

  const events = detectionEvents?.items || [];
  const total = detectionEvents?.total || 0;
  const totalPages = detectionEvents?.total_pages || 1;

  const reviewStatusColors: Record<ReviewStatus, string> = {
    pending: 'badge-warning',
    confirmed: 'badge-danger',
    false_positive: 'badge-success',
    dismissed: 'badge-gray',
  };

  const reviewStatusIcons: Record<ReviewStatus, React.ReactNode> = {
    pending: <Clock className="h-3 w-3" />,
    confirmed: <CheckCircle className="h-3 w-3" />,
    false_positive: <XCircle className="h-3 w-3" />,
    dismissed: <AlertTriangle className="h-3 w-3" />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detection Events</h1>
          <p className="text-gray-500 mt-1">Review and manage mobile phone detection events</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="label">Camera</label>
              <select
                value={filters.camera_id}
                onChange={(e) => handleFilterChange('camera_id', e.target.value)}
                className="input"
              >
                <option value="">All Cameras</option>
                {cameras.map(({ camera }) => (
                  <option key={camera.id} value={camera.id.toString()}>
                    {camera.camera_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Zone</label>
              <select
                value={filters.zone_id}
                onChange={(e) => handleFilterChange('zone_id', e.target.value)}
                className="input"
              >
                <option value="">All Zones</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id.toString()}>
                    {zone.zone_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Review Status</label>
              <select
                value={filters.review_status}
                onChange={(e) => handleFilterChange('review_status', e.target.value)}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="false_positive">False Positive</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Min Confidence</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={filters.min_confidence}
                onChange={(e) => handleFilterChange('min_confidence', e.target.value)}
                className="input"
                placeholder="0.50"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button onClick={clearFilters} className="btn-secondary text-sm">
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {events.length} of {total} events
        </span>
        {hasActiveFilters && (
          <span className="text-primary-600">Filtered results</span>
        )}
      </div>

      {/* Events Table */}
      <div className="card">
        {detectionEventsLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-gray-500">Loading detection events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>{hasActiveFilters ? 'No events match your filters' : 'No detection events recorded'}</p>
            {!hasActiveFilters && <p className="text-sm mt-1">Events will appear here when phones are detected</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Camera / Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Object</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Review Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Snapshot</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-900 font-mono">
                        {format(new Date(event.start_time), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{event.camera_name || `Camera #${event.camera_id}`}</p>
                          {event.zone_name && (
                            <p className="text-sm text-gray-500">{event.zone_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{event.detected_object}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {(event.confidence * 100).toFixed(1)}%
                          </span>
                          <div className="h-2 w-24 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-primary-600 rounded"
                              style={{ width: `${event.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {event.duration_seconds ? `${event.duration_seconds.toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`${reviewStatusColors[event.review_status]} flex items-center gap-1`}>
                          {reviewStatusIcons[event.review_status]}
                          {event.review_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {event.snapshot_path ? (
                          <span className="badge-primary">Available</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingEvent(event)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {event.review_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleReview(event.id, 'confirmed')}
                                className="p-2 rounded-lg text-success-600 hover:bg-success-50"
                                title="Confirm"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleReview(event.id, 'false_positive')}
                                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                                title="False Positive"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={deletingId === event.id}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger-600 disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === event.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Event Detail Modal */}
      {viewingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Detection Event Details</h2>
              <button
                onClick={() => setViewingEvent(null)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Event ID</p>
                  <p className="font-medium">{viewingEvent.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Camera</p>
                  <p className="font-medium">{viewingEvent.camera_name || `Camera #${viewingEvent.camera_id}`}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="font-medium">{viewingEvent.zone_name || 'No zone'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Detected Object</p>
                  <p className="font-medium">{viewingEvent.detected_object}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Confidence</p>
                  <p className="font-medium">{(viewingEvent.confidence * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Time</p>
                  <p className="font-medium">{format(new Date(viewingEvent.start_time), 'MMM d, yyyy HH:mm:ss')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">End Time</p>
                  <p className="font-medium">
                    {viewingEvent.end_time ? format(new Date(viewingEvent.end_time), 'MMM d, yyyy HH:mm:ss') : 'Ongoing'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium">
                    {viewingEvent.duration_seconds ? `${viewingEvent.duration_seconds.toFixed(1)}s` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Review Status</p>
                  <span className={`${reviewStatusColors[viewingEvent.review_status as ReviewStatus]} flex items-center gap-1`}>
                    {reviewStatusIcons[viewingEvent.review_status as ReviewStatus]}
                    {viewingEvent.review_status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {viewingEvent.snapshot_path && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 mb-2">Snapshot</p>
                  <img
                    src={`/snapshots/${viewingEvent.snapshot_path.split('/').pop()}`}
                    alt="Detection snapshot"
                    className="max-w-full h-auto rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}