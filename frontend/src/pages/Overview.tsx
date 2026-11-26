import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Camera as CameraIcon,
  Clock,
  MapPin,
  MonitorPlay,
  RefreshCw,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { api, getErrorMessage } from '../services/api';
import type { DetectionEventWithDetails } from '../types';
import { CameraStatusBadge, EmptyState, ErrorState, PageHeader, ReviewBadge, Spinner, StatCard } from '../components/ui';
import { chartAxisTick, chartGrid, seriesColors, tooltipStyle } from '../utils/chart';
import { formatDuration, relativeTime, percent } from '../utils/format';

export function Overview() {
  const { zones, cameras, stats, activeDetections, refreshStats, refreshActive, loading } = useApp();
  const [recent, setRecent] = useState<DetectionEventWithDetails[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const response = await api.getDetectionEvents({ page: 1, page_size: 8 });
      setRecent(response.items);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load recent detections'));
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
    const interval = setInterval(() => {
      void loadRecent();
      void refreshStats();
      void refreshActive();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadRecent, refreshStats, refreshActive]);

  const activeCameras = cameras.filter((entry) => entry.status?.status === 'active').length;
  const monitoringCameras = cameras.filter((entry) => entry.status?.is_monitoring).length;

  const trendData = (stats?.detections_by_day ?? []).slice(-14).map((item) => ({
    date: item.date.slice(5),
    detections: item.count,
  }));

  const zoneData = [...zones]
    .sort((a, b) => b.total_detections - a.total_detections)
    .slice(0, 6)
    .map((zone) => ({
      zone: zone.zone_name.length > 16 ? `${zone.zone_name.slice(0, 16)}…` : zone.zone_name,
      detections: zone.total_detections,
      active: activeDetections.filter((session) => session.zone_id === zone.id).length,
    }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        subtitle="Live status of zones, cameras and mobile phone detections"
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-md border border-line bg-ink-900 px-2.5 py-1.5 text-xs text-mute sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-400" />
              </span>
              Auto-refresh 15s
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void loadRecent();
                void refreshStats();
                void refreshActive();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Registered Zones"
          value={zones.length}
          hint={`${zones.reduce((sum, zone) => sum + zone.camera_count, 0)} assigned cameras`}
          icon={<MapPin className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Active Cameras"
          value={activeCameras}
          hint={`${cameras.length} registered · ${monitoringCameras} monitoring`}
          icon={<CameraIcon className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Total Detections"
          value={(stats?.total_detections ?? 0).toLocaleString()}
          hint="All recorded mobile phone events"
          icon={<Smartphone className="h-4 w-4" />}
        />
        <StatCard
          label="Today's Detections"
          value={(stats?.detections_today ?? 0).toLocaleString()}
          hint={`${stats?.detections_this_week ?? 0} this week`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Active Now"
          value={activeDetections.length}
          hint={activeDetections.length > 0 ? 'Phone currently visible' : 'No phone detected'}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={activeDetections.length > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {activeDetections.length > 0 && (
        <div className="card border-danger-500/30 bg-danger-500/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-danger-500/20 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-danger-300">
              <Activity className="h-4 w-4" />
              Active detections
            </div>
            <Link to="/live" className="btn-secondary py-1.5 text-xs">
              <MonitorPlay className="h-3.5 w-3.5" />
              Open live monitoring
            </Link>
          </div>
          <div className="divide-y divide-line/70">
            {activeDetections.map((session) => {
              const camera = cameras.find((entry) => entry.camera.id === session.camera_id)?.camera;
              const zone = zones.find((item) => item.id === session.zone_id);
              return (
                <div key={session.session_id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-200">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-danger-400" />
                    </span>
                    Mobile Phone
                  </span>
                  <span className="text-mute">{camera?.camera_name ?? `Camera #${session.camera_id}`}</span>
                  <span className="text-mute">{zone?.zone_name ?? 'Unassigned zone'}</span>
                  <span className="tabular-nums text-danger-300">{percent(session.max_confidence)}</span>
                  <span className="tabular-nums text-mute">{formatDuration(session.duration_seconds)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Detection trend</h2>
              <p className="text-xs text-mute">Daily detections over the last 14 days</p>
            </div>
            <span className="badge-blue">{stats?.detections_this_month ?? 0} this month</span>
          </div>
          <div className="h-64 px-3 py-4">
            {loading.stats && !stats ? (
              <div className="flex h-full items-center justify-center text-mute">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="date" tick={chartAxisTick} tickLine={false} axisLine={{ stroke: chartGrid }} />
                  <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#243244' }} />
                  <Area
                    type="monotone"
                    dataKey="detections"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#overviewArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Zone-wise detections</h2>
              <p className="text-xs text-mute">Top zones by recorded detections</p>
            </div>
            <Link to="/zones" className="text-xs font-medium text-primary-400 hover:text-primary-300">
              Manage zones
            </Link>
          </div>
          <div className="h-64 px-3 py-4">
            {zoneData.length === 0 ? (
              <EmptyState icon={<MapPin className="h-7 w-7" />} title="No zones configured yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneData} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis
                    dataKey="zone"
                    tick={{ ...chartAxisTick, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: chartGrid }}
                    interval={0}
                  />
                  <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#141c28' }} />
                  <Bar dataKey="detections" radius={[3, 3, 0, 0]} maxBarSize={38}>
                    {zoneData.map((_, index) => (
                      <Cell key={index} fill={seriesColors[index % seriesColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent detection activity</h2>
              <p className="text-xs text-mute">Latest mobile phone events recorded by the backend</p>
            </div>
            <Link to="/detections" className="text-xs font-medium text-primary-400 hover:text-primary-300">
              View history
            </Link>
          </div>
          {recentLoading ? (
            <div className="flex items-center justify-center py-16 text-mute">
              <Spinner className="h-5 w-5" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void loadRecent()} />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Smartphone className="h-7 w-7" />}
              title="No detections recorded"
              description="Detection events will appear here after monitoring runs and a mobile phone is detected."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Camera</th>
                    <th>Zone</th>
                    <th>Confidence</th>
                    <th>Duration</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap text-xs text-mute" title={event.start_time}>
                        {relativeTime(event.start_time)}
                      </td>
                      <td className="font-medium text-slate-200">{event.camera_name ?? `Camera #${event.camera_id}`}</td>
                      <td className="text-xs text-mute">{event.zone_name ?? 'Unassigned'}</td>
                      <td className="tabular-nums">{percent(event.confidence)}</td>
                      <td className="tabular-nums text-xs text-mute">{formatDuration(event.duration_seconds)}</td>
                      <td>
                        <ReviewBadge status={event.review_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Camera status</h2>
              <p className="text-xs text-mute">{cameras.length} registered cameras</p>
            </div>
            <Link to="/cameras" className="text-xs font-medium text-primary-400 hover:text-primary-300">
              Manage
            </Link>
          </div>
          {cameras.length === 0 ? (
            <EmptyState icon={<CameraIcon className="h-7 w-7" />} title="No cameras registered" />
          ) : (
            <div className="divide-y divide-line/70">
              {cameras.slice(0, 8).map(({ camera, status }) => {
                const zone = zones.find((item) => item.id === camera.zone_id);
                return (
                  <div key={camera.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{camera.camera_name}</p>
                      <p className="truncate text-xs text-mute">
                        {zone?.zone_name ?? 'Unassigned'} · {camera.camera_source}
                      </p>
                    </div>
                    <CameraStatusBadge status={status?.status ?? camera.status} monitoring={status?.is_monitoring} />
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-5 py-3 text-xs text-mute">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {monitoringCameras} monitoring now
                </span>
                <span>{activeCameras} online</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
