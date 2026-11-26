import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Zone,
  ZoneWithStats,
  Camera,
  CameraWithStatus,
  CameraPreview,
  WebcamDevice,
  DetectionEvent,
  DetectionEventWithDetails,
  DetectionStats,
  ActiveDetectionSession,
  PaginatedResponse,
  ReviewStatus,
  DetectionEventFilters,
  HealthInfo,
  AppSettings,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Base origin without the /api suffix, used for /health and /snapshots.
export const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : '';

export function snapshotUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const filename = path.split(/[\\/]/).pop();
  return filename ? `${API_ORIGIN}/snapshots/${encodeURIComponent(filename)}` : null;
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: unknown; message?: string }>;
    const detail = axiosError.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string; loc?: unknown[] };
      if (first?.msg) {
        const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
        return field ? `${field}: ${first.msg}` : first.msg;
      }
    }
    if (axiosError.response?.data?.message) return axiosError.response.data.message;
    if (axiosError.code === 'ECONNABORTED') return 'Request timed out';
    if (!axiosError.response) return 'Cannot reach the backend server';
    return axiosError.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // Zones
  async getZones(params?: { page?: number; page_size?: number; search?: string }): Promise<Zone[]> {
    const response = await this.client.get('/zones/', { params });
    return response.data.data;
  }

  async getZonesWithStats(): Promise<ZoneWithStats[]> {
    const response = await this.client.get('/zones/stats');
    return response.data.data;
  }

  async getZone(id: number): Promise<Zone> {
    const response = await this.client.get(`/zones/${id}`);
    return response.data.data;
  }

  async getZoneStats(id: number): Promise<ZoneWithStats> {
    const response = await this.client.get(`/zones/${id}/stats`);
    return response.data.data;
  }

  async createZone(data: { zone_name: string; zone_description?: string }): Promise<Zone> {
    const response = await this.client.post('/zones/', data);
    return response.data.data;
  }

  async updateZone(id: number, data: Partial<Zone>): Promise<Zone> {
    const response = await this.client.put(`/zones/${id}`, data);
    return response.data.data;
  }

  async deleteZone(id: number): Promise<void> {
    await this.client.delete(`/zones/${id}`);
  }

  // Cameras
  async getCameras(params?: {
    page?: number;
    page_size?: number;
    zone_id?: number;
    status?: string;
    search?: string;
  }): Promise<Camera[]> {
    const response = await this.client.get('/cameras/', { params });
    return response.data.data;
  }

  async getCamerasWithStatus(): Promise<CameraWithStatus[]> {
    const response = await this.client.get('/cameras/with-status');
    return response.data.data;
  }

  async getAvailableDevices(): Promise<WebcamDevice[]> {
    const response = await this.client.get('/cameras/available-devices');
    return response.data.data;
  }

  async getCamera(id: number): Promise<Camera> {
    const response = await this.client.get(`/cameras/${id}`);
    return response.data.data;
  }

  async getCameraPreview(id: number): Promise<CameraPreview> {
    const response = await this.client.get(`/cameras/${id}/preview`);
    return response.data.data;
  }

  async createCamera(data: {
    camera_name: string;
    camera_source: string;
    zone_id?: number;
  }): Promise<Camera> {
    const response = await this.client.post('/cameras/', data);
    return response.data.data;
  }

  async updateCamera(id: number, data: Partial<Camera>): Promise<Camera> {
    const response = await this.client.put(`/cameras/${id}`, data);
    return response.data.data;
  }

  async deleteCamera(id: number): Promise<void> {
    await this.client.delete(`/cameras/${id}`);
  }

  async connectCamera(id: number): Promise<void> {
    await this.client.post(`/cameras/${id}/connect`);
  }

  async disconnectCamera(id: number): Promise<void> {
    await this.client.post(`/cameras/${id}/disconnect`);
  }

  async startMonitoring(id: number): Promise<void> {
    await this.client.post(`/cameras/${id}/start-monitoring`);
  }

  async stopMonitoring(id: number): Promise<void> {
    await this.client.post(`/cameras/${id}/stop-monitoring`);
  }

  // Detection Events
  async getDetectionEvents(
    params?: DetectionEventFilters,
  ): Promise<PaginatedResponse<DetectionEventWithDetails>> {
    const response = await this.client.get('/detection-events/', { params });
    return response.data;
  }

  async getDetectionStats(): Promise<DetectionStats> {
    const response = await this.client.get('/detection-events/stats');
    return response.data.data;
  }

  async getActiveDetections(): Promise<ActiveDetectionSession[]> {
    const response = await this.client.get('/detection-events/active');
    return response.data.data;
  }

  async getDetectionEvent(id: number): Promise<DetectionEventWithDetails> {
    const response = await this.client.get(`/detection-events/${id}`);
    return response.data.data;
  }

  async updateReviewStatus(id: number, review_status: ReviewStatus): Promise<DetectionEvent> {
    const response = await this.client.put(`/detection-events/${id}/review`, null, {
      params: { review_status },
    });
    return response.data.data;
  }

  async deleteDetectionEvent(id: number): Promise<void> {
    await this.client.delete(`/detection-events/${id}`);
  }

  async exportDetectionEventsCsv(params?: DetectionEventFilters): Promise<Blob> {
    const response = await this.client.get('/detection-events/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    const response = await this.client.get('/settings/');
    return response.data.data;
  }

  async updateSettings(data: {
    confidence_threshold: number;
    iou_threshold: number;
    interruption_tolerance: number;
    min_duration: number;
    snapshot_enabled: boolean;
  }): Promise<AppSettings> {
    const response = await this.client.put('/settings/', data);
    return response.data.data;
  }

  // Health
  async healthCheck(): Promise<HealthInfo> {
    const response = await this.client.get(`${API_ORIGIN}/health`);
    return response.data;
  }
}

export const api = new ApiService();
