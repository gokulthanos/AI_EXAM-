import { useApp } from '../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  Clock,
  MapPin,
  Video,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export function Analytics() {
  const { stats } = useApp();
  const detectionStats = stats;

  // Color palette for charts
  const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  if (!detectionStats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Detection analytics and insights</p>
        </div>
        <div className="card p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-2" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const hourlyData = detectionStats.detections_by_hour.map((d) => ({
    hour: `${d.hour.toString().padStart(2, '0')}:00`,
    detections: d.count,
  }));

  const dailyData = detectionStats.detections_by_day.map((d) => ({
    date: d.date,
    detections: d.count,
  }));

  const topZonesData = detectionStats.top_zones.map((z, i) => ({
    zone: z.zone_name.length > 15 ? z.zone_name.substring(0, 15) + '...' : z.zone_name,
    count: z.count,
    color: COLORS[i % COLORS.length],
  }));

  const topCamerasData = detectionStats.top_cameras.map((c, i) => ({
    camera: c.camera_name.length > 15 ? c.camera_name.substring(0, 15) + '...' : c.camera_name,
    count: c.count,
    color: COLORS[i % COLORS.length],
  }));

  const reviewStatusData = [
    { name: 'Pending', value: detectionStats.pending_reviews, color: '#f59e0b' },
    { name: 'Confirmed', value: detectionStats.confirmed_detections, color: '#ef4444' },
    { name: 'False Positive', value: detectionStats.false_positives, color: '#22c55e' },
  ].filter((d) => d.value > 0);

  const statCards = [
    {
      title: 'Total Detections',
      value: detectionStats.total_detections.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Today',
      value: detectionStats.detections_today.toLocaleString(),
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'This Week',
      value: detectionStats.detections_this_week.toLocaleString(),
      icon: BarChart3,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'This Month',
      value: detectionStats.detections_this_month.toLocaleString(),
      icon: MapPin,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Avg Confidence',
      value: `${(detectionStats.avg_confidence * 100).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: 'Avg Duration',
      value: `${detectionStats.avg_duration_seconds.toFixed(1)}s`,
      icon: Clock,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
    },
    {
      title: 'Pending Review',
      value: detectionStats.pending_reviews.toLocaleString(),
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      title: 'Confirmed',
      value: detectionStats.confirmed_detections.toLocaleString(),
      icon: CheckCircle,
      color: 'text-danger-600',
      bg: 'bg-danger-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Detection analytics and insights</p>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detections by Hour */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-600" />
            Detections by Hour (Last 24h)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  labelFormatter={(hour) => `Hour: ${hour}`}
                />
                <Bar
                  dataKey="detections"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detections by Day */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            Detections by Day (Last 30 Days)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  labelFormatter={(date) => `Date: ${date}`}
                />
                <Line
                  type="monotone"
                  dataKey="detections"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Zones */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary-600" />
            Top Zones by Detections
          </h3>
          <div className="h-72">
            {topZonesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topZonesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="zone"
                    type="category"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                  >
                    {topZonesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No zone data available
              </div>
            )}
          </div>
        </div>

        {/* Top Cameras */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Video className="h-5 w-5 text-primary-600" />
            Top Cameras by Detections
          </h3>
          <div className="h-72">
            {topCamerasData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCamerasData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="camera"
                    type="category"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                  >
                    {topCamerasData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No camera data available
              </div>
            )}
          </div>
        </div>

        {/* Review Status Pie Chart */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary-600" />
            Review Status Distribution
          </h3>
          <div className="h-72 flex items-center justify-center">
            {reviewStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reviewStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {reviewStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Detections']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-500">No review data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}