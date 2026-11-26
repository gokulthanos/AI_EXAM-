import { useApp } from '../context/AppContext';
import {
  Camera,
  AlertTriangle,
  Clock,
  TrendingUp,
  Eye,
  PlayCircle,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export function Dashboard() {
  const {
    stats,
    activeDetections,
    cameras,
    refreshStats,
    refreshActive,
    refreshCameras,
    startMonitoring,
    stopMonitoring,
  } = useApp();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshCameras();
      refreshStats();
      refreshActive();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshCameras, refreshStats, refreshActive]);

  const totalCameras = cameras.length;
  const activeCameras = cameras.filter((entry) => entry.status?.status === 'active').length;
  const monitoringCameras = cameras.filter((entry) => entry.status?.is_monitoring).length;
  const errorCameras = cameras.filter((entry) => entry.status?.status === 'error').length;

  const statCards = [
    {
      title: 'Total Cameras',
      value: totalCameras,
      icon: Camera,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      title: 'Active Cameras',
      value: activeCameras,
      icon: Eye,
      color: 'text-success-600',
      bg: 'bg-success-50',
    },
    {
      title: 'Monitoring',
      value: monitoringCameras,
      icon: Eye,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Errors',
      value: errorCameras,
      icon: AlertTriangle,
      color: 'text-danger-600',
      bg: 'bg-danger-50',
    },
    {
      title: 'Total Detections',
      value: stats?.total_detections ?? 0,
      icon: AlertTriangle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Today',
      value: stats?.detections_today ?? 0,
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'Pending Review',
      value: stats?.pending_reviews ?? 0,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      title: 'Active Now',
      value: activeDetections.length,
      icon: AlertTriangle,
      color: activeDetections.length > 0 ? 'text-danger-600' : 'text-gray-600',
      bg: activeDetections.length > 0 ? 'bg-danger-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Real-time mobile phone detection monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={() => {
              refreshCameras();
              refreshStats();
              refreshActive();
            }}
            className="btn-secondary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Detections Alert */}
      {activeDetections.length > 0 && (
        <div className="card border-danger-200">
          <div className="p-4 border-b border-danger-200 bg-danger-50">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-danger-800">
              <AlertTriangle className="h-5 w-5" />
              Active Detections ({activeDetections.length})
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {activeDetections.map((detection) => (
                <div key={detection.session_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-100 text-danger-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Camera #{detection.camera_id}</p>
                      <p className="text-sm text-gray-500">
                        Zone: {detection.zone_id ?? 'Unknown'} • {detection.detection_count} detections
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded bg-danger-100 text-danger-700 font-medium">
                        {Math.round(detection.max_confidence * 100)}%
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {Math.round(detection.duration_seconds)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cameras Grid */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Cameras</h2>
        </div>
        <div className="p-4">
          {cameras.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Camera className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No cameras configured</p>
              <p className="text-sm mt-1">Add cameras from the Cameras page</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cameras.map(({ camera, status }) => (
                <div
                  key={camera.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    status?.is_monitoring ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{camera.camera_name}</h3>
                      <p className="text-sm text-gray-500 truncate">{camera.camera_source}</p>
                    </div>
                    <span
                      className={`badge ${
                        status?.status === 'active' ? 'badge-success' :
                        status?.status === 'error' ? 'badge-danger' :
                        'badge-gray'
                      }`}
                    >
                      {status?.status ?? camera.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {status?.is_monitoring && (
                      <span className="flex items-center gap-1 text-success-600">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
                        </span>
                        Monitoring
                      </span>
                    )}
                    {status?.current_fps && (
                      <span>{status.current_fps.toFixed(1)} FPS</span>
                    )}
                    {status?.error_message && (
                      <span className="text-danger-600 truncate max-w-[150px]">{status.error_message}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!status?.is_monitoring ? (
                      <button
                        onClick={() => startMonitoring(camera.id)}
                        className="flex-1 btn-success text-xs py-1.5"
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={() => stopMonitoring(camera.id)}
                        className="flex-1 btn-danger text-xs py-1.5"
                      >
                        <PauseCircle className="h-4 w-4 mr-1" />
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => refreshCameras()}
                      className="btn-outline text-xs py-1.5"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Detections Summary */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detection Trend */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detections by Hour (24h)</h3>
            <div className="h-64">
              <pre className="text-xs text-gray-500 font-mono overflow-auto">
{stats.detections_by_hour.map((d) => `${d.hour.toString().padStart(2, '0')}:00 ${'█'.repeat(Math.min(d.count, 30))} ${d.count}`).join('\n')}
              </pre>
            </div>
          </div>

          {/* Top Zones */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Zones</h3>
            <div className="space-y-3">
              {stats.top_zones.length > 0 ? (
                stats.top_zones.map((zone, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                      <span className="font-medium text-gray-900">{zone.zone_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-primary">{zone.count}</span>
                      <div className="h-2 w-32 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded"
                          style={{ width: `${(zone.count / Math.max(...stats.top_zones.map((z) => z.count))) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No detection data yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}