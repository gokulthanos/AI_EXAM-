import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type {
  Zone,
  ZoneWithStats,
  Camera,
  CameraWithStatus,
  CameraStatusInfo,
  ActiveDetectionSession,
  DetectionAlert,
  DetectionStats,
  HealthInfo,
  WebSocketMessage,
  DetectionEventWithDetails,
  PaginatedResponse,
  ReviewStatus,
} from '../types';
import { api, getErrorMessage } from '../services/api';
import { ws } from '../services/websocket';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface LoadingState {
  zones: boolean;
  cameras: boolean;
  stats: boolean;
}

interface AppContextValue {
  zones: ZoneWithStats[];
  cameras: CameraWithStatus[];
  stats: DetectionStats | null;
  activeDetections: ActiveDetectionSession[];
  alerts: DetectionAlert[];
  health: HealthInfo | null;
  wsConnected: boolean;
  loading: LoadingState;
  toasts: Toast[];
  detectionEvents: PaginatedResponse<DetectionEventWithDetails> | null;
  detectionEventsLoading: boolean;
  detectorInfo: any;

  notify: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;

  refreshZones: () => Promise<void>;
  refreshCameras: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshActive: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshDetectionEvents: () => Promise<void>;
  loadDetectionEvents: (params?: any) => Promise<void>;

  createZone: (data: { zone_name: string; zone_description?: string }) => Promise<Zone>;
  updateZone: (id: number, data: { zone_name?: string; zone_description?: string | null }) => Promise<Zone>;
  deleteZone: (id: number) => Promise<void>;

  createCamera: (data: { camera_name: string; camera_source: string; zone_id?: number }) => Promise<Camera>;
  updateCamera: (
    id: number,
    data: { camera_name?: string; camera_source?: string; zone_id?: number | null },
  ) => Promise<Camera>;
  deleteCamera: (id: number) => Promise<void>;
  connectCamera: (id: number) => Promise<void>;
  disconnectCamera: (id: number) => Promise<void>;
  startMonitoring: (id: number) => Promise<void>;
  stopMonitoring: (id: number) => Promise<void>;

  updateReviewStatus: (id: number, review_status: ReviewStatus) => Promise<void>;
  deleteDetectionEvent: (id: number) => Promise<void>;
  exportDetectionEventsCsv: (params?: any) => Promise<void>;

  loadSettings: () => Promise<any>;
  updateSettings: (data: any) => Promise<any>;

  zoneName: (zoneId: number | null | undefined) => string;
  cameraName: (cameraId: number | null | undefined) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [cameras, setCameras] = useState<CameraWithStatus[]>([]);
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [activeDetections, setActiveDetections] = useState<ActiveDetectionSession[]>([]);
  const [alerts, setAlerts] = useState<DetectionAlert[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({ zones: true, cameras: true, stats: true });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [detectionEvents, setDetectionEvents] = useState<PaginatedResponse<DetectionEventWithDetails> | null>(null);
  const [detectionEventsLoading, setDetectionEventsLoading] = useState(false);
  const [detectorInfo, setDetectorInfo] = useState<any>(null);
  const toastId = useRef(0);

  const notify = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, kind, message }].slice(-4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const refreshZones = useCallback(async () => {
    setLoading((prev) => ({ ...prev, zones: true }));
    try {
      const data = await api.getZonesWithStats();
      setZones(data);
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to load zones'), 'error');
    } finally {
      setLoading((prev) => ({ ...prev, zones: false }));
    }
  }, [notify]);

  const refreshCameras = useCallback(async () => {
    setLoading((prev) => ({ ...prev, cameras: true }));
    try {
      const data = await api.getCamerasWithStatus();
      setCameras(data);
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to load cameras'), 'error');
    } finally {
      setLoading((prev) => ({ ...prev, cameras: false }));
    }
  }, [notify]);

  const refreshStats = useCallback(async () => {
    setLoading((prev) => ({ ...prev, stats: true }));
    try {
      const data = await api.getDetectionStats();
      setStats(data);
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to load detection statistics'), 'error');
    } finally {
      setLoading((prev) => ({ ...prev, stats: false }));
    }
  }, [notify]);

  const refreshActive = useCallback(async () => {
    try {
      const data = await api.getActiveDetections();
      setActiveDetections(data);
    } catch {
      // Active detections are best-effort; WebSocket updates also drive this state.
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const data = await api.healthCheck();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  const loadDetectorInfo = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setDetectorInfo(data);
    } catch {
      setDetectorInfo(null);
    }
  }, []);

  const refreshDetectionEvents = useCallback(async () => {
    // This will be called by pages that need detection events
    // The actual loading is handled by the page components
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshZones(), refreshCameras(), refreshStats(), refreshActive(), refreshHealth()]);
  }, [refreshZones, refreshCameras, refreshStats, refreshActive, refreshHealth]);

  // Detection Events functions
  const loadDetectionEvents = useCallback(async (params: any = {}) => {
    setDetectionEventsLoading(true);
    try {
      const data = await api.getDetectionEvents(params);
      setDetectionEvents(data);
    } catch (error) {
      notify(getErrorMessage(error, 'Failed to load detection events'), 'error');
    } finally {
      setDetectionEventsLoading(false);
    }
  }, [notify]);

  const updateReviewStatus = useCallback(async (id: number, review_status: ReviewStatus) => {
    await api.updateReviewStatus(id, review_status);
    // Refresh detection events to reflect the change
    if (detectionEvents) {
      setDetectionEvents(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(event =>
            event.id === id ? { ...event, review_status } : event
          ),
        };
      });
    }
    notify(`Review status updated to ${review_status}`, 'success');
  }, [detectionEvents, notify]);

  const deleteDetectionEvent = useCallback(async (id: number) => {
    await api.deleteDetectionEvent(id);
    setDetectionEvents(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter(event => event.id !== id),
        total: prev.total - 1,
      };
    });
    notify('Detection event deleted', 'success');
  }, [notify]);

  const exportDetectionEventsCsv = useCallback(async (params: any = {}) => {
    await api.exportDetectionEventsCsv(params);
    notify('CSV export started', 'success');
  }, [notify]);

  const loadSettings = useCallback(async () => {
    return await api.getSettings();
  }, []);

  const updateSettings = useCallback(async (data: any) => {
    const settings = await api.updateSettings(data);
    notify('Settings updated', 'success');
    return settings;
  }, [notify]);

  // WebSocket lifecycle
  useEffect(() => {
    const offConnection = ws.onConnectionChange(setWsConnected);

    const offDetection = ws.onMessage('detection_alert', (message: WebSocketMessage) => {
      const alert = message as DetectionAlert;
      setAlerts((prev) => [alert, ...prev].slice(0, 40));

      if (alert.event_type === 'ended') {
        setActiveDetections((prev) => prev.filter((session) => session.session_id !== alert.session_id));
        void refreshStats();
      } else {
        setActiveDetections((prev) => {
          const startTime =
            alert.event_type === 'started'
              ? alert.timestamp
              : new Date(Date.now() - alert.duration_seconds * 1000).toISOString();
          const next: ActiveDetectionSession = {
            session_id: alert.session_id,
            camera_id: alert.camera_id,
            zone_id: alert.zone_id,
            start_time: prev.find((s) => s.session_id === alert.session_id)?.start_time ?? startTime,
            duration_seconds: alert.duration_seconds,
            max_confidence: alert.confidence,
            detection_count: alert.detection_count,
            last_bbox: alert.last_bbox,
          };
          return prev.some((session) => session.session_id === alert.session_id)
            ? prev.map((session) => (session.session_id === alert.session_id ? next : session))
            : [...prev, next];
        });
      }

      if (alert.event_type === 'started') {
        notify('Mobile phone detected on a monitored camera', 'error');
      }
    });

    const offActive = ws.onMessage('active_detections', (message: WebSocketMessage) => {
      if (Array.isArray(message.data)) setActiveDetections(message.data as ActiveDetectionSession[]);
    });

    const offCameraStatuses = ws.onMessage('camera_statuses', (message: WebSocketMessage) => {
      if (!Array.isArray(message.data)) return;
      const statuses = message.data as CameraStatusInfo[];
      setCameras((prev) =>
        prev.map((entry) => {
          const status = statuses.find((item) => item.camera_id === entry.camera.id);
          return status ? { ...entry, status } : entry;
        }),
      );
    });

    ws.connect().catch(() => {
      // Reconnection is handled inside the service; the UI shows offline state.
    });

    return () => {
      offDetection();
      offActive();
      offCameraStatuses();
      offConnection();
      ws.disconnect();
    };
  }, [notify, refreshStats]);

  // Initial load + periodic refresh of live state
  useEffect(() => {
    void refreshAll();
    void loadDetectorInfo();
    const interval = setInterval(() => {
      void refreshActive();
      void refreshCameras();
    }, 10000);
    const healthInterval = setInterval(() => {
      void refreshHealth();
    }, 30000);
    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
    };
  }, [refreshAll, refreshActive, refreshCameras, refreshHealth, loadDetectorInfo]);

  // Mutations
  const createZone = useCallback(
    async (data: { zone_name: string; zone_description?: string }) => {
      const zone = await api.createZone(data);
      await refreshZones();
      return zone;
    },
    [refreshZones],
  );

  const updateZone = useCallback(
    async (id: number, data: { zone_name?: string; zone_description?: string | null }) => {
      const zone = await api.updateZone(id, data);
      await refreshZones();
      return zone;
    },
    [refreshZones],
  );

  const deleteZone = useCallback(
    async (id: number) => {
      await api.deleteZone(id);
      await Promise.all([refreshZones(), refreshCameras()]);
    },
    [refreshZones, refreshCameras],
  );

  const createCamera = useCallback(
    async (data: { camera_name: string; camera_source: string; zone_id?: number }) => {
      const camera = await api.createCamera(data);
      await Promise.all([refreshCameras(), refreshZones()]);
      return camera;
    },
    [refreshCameras, refreshZones],
  );

  const updateCamera = useCallback(
    async (
      id: number,
      data: { camera_name?: string; camera_source?: string; zone_id?: number | null },
    ) => {
      const camera = await api.updateCamera(id, data);
      await Promise.all([refreshCameras(), refreshZones()]);
      return camera;
    },
    [refreshCameras, refreshZones],
  );

  const deleteCamera = useCallback(
    async (id: number) => {
      await api.deleteCamera(id);
      await Promise.all([refreshCameras(), refreshZones(), refreshStats()]);
    },
    [refreshCameras, refreshZones, refreshStats],
  );

  const connectCamera = useCallback(
    async (id: number) => {
      await api.connectCamera(id);
      await refreshCameras();
    },
    [refreshCameras],
  );

  const disconnectCamera = useCallback(
    async (id: number) => {
      await api.disconnectCamera(id);
      await refreshCameras();
    },
    [refreshCameras],
  );

  const startMonitoring = useCallback(
    async (id: number) => {
      await api.startMonitoring(id);
      await refreshCameras();
    },
    [refreshCameras],
  );

  const stopMonitoring = useCallback(
    async (id: number) => {
      await api.stopMonitoring(id);
      await Promise.all([refreshCameras(), refreshActive()]);
    },
    [refreshCameras, refreshActive],
  );

  const zoneName = useCallback(
    (zoneId: number | null | undefined) => {
      if (zoneId === null || zoneId === undefined) return 'Unassigned';
      return zones.find((zone) => zone.id === zoneId)?.zone_name ?? `Zone #${zoneId}`;
    },
    [zones],
  );

  const cameraName = useCallback(
    (cameraId: number | null | undefined) => {
      if (cameraId === null || cameraId === undefined) return 'Unknown camera';
      return cameras.find((entry) => entry.camera.id === cameraId)?.camera.camera_name ?? `Camera #${cameraId}`;
    },
    [cameras],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      zones,
      cameras,
      stats,
      activeDetections,
      alerts,
      health,
      wsConnected,
      loading,
      toasts,
      detectionEvents,
      detectionEventsLoading,
      detectorInfo,

      notify,
      dismissToast,

      refreshZones,
      refreshCameras,
      refreshStats,
      refreshActive,
      refreshHealth,
      refreshAll,
      refreshDetectionEvents,

      createZone,
      updateZone,
      deleteZone,

      createCamera,
      updateCamera,
      deleteCamera,
      connectCamera,
      disconnectCamera,
      startMonitoring,
      stopMonitoring,

      loadDetectionEvents,
      updateReviewStatus,
      deleteDetectionEvent,
      exportDetectionEventsCsv,

      loadSettings,
      updateSettings,

      zoneName,
      cameraName,
    }),
    [
      zones,
      cameras,
      stats,
      activeDetections,
      alerts,
      health,
      wsConnected,
      loading,
      toasts,
      detectionEvents,
      detectionEventsLoading,
      detectorInfo,
      notify,
      dismissToast,
      refreshZones,
      refreshCameras,
      refreshStats,
      refreshActive,
      refreshHealth,
      refreshAll,
      refreshDetectionEvents,
      loadDetectionEvents,
      createZone,
      updateZone,
      deleteZone,
      createCamera,
      updateCamera,
      deleteCamera,
      connectCamera,
      disconnectCamera,
      startMonitoring,
      stopMonitoring,
      updateReviewStatus,
      deleteDetectionEvent,
      exportDetectionEventsCsv,
      loadSettings,
      updateSettings,
      zoneName,
      cameraName,
      detectorInfo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
