// TypeScript types matching backend schemas

export type CameraStatus = 'active' | 'inactive' | 'error' | 'disconnected';

export type ReviewStatus = 'pending' | 'confirmed' | 'false_positive' | 'dismissed';

export interface Zone {
  id: number;
  zone_name: string;
  zone_description: string | null;
  created_at: string;
}

export interface ZoneWithStats extends Zone {
  camera_count: number;
  active_camera_count: number;
  total_detections: number;
  pending_reviews: number;
}

export interface Camera {
  id: number;
  camera_name: string;
  camera_source: string;
  zone_id: number | null;
  status: CameraStatus;
  created_at: string;
}

export interface CameraStatusInfo {
  camera_id: number;
  camera_name: string;
  status: CameraStatus;
  is_monitoring: boolean;
  current_fps: number | null;
  last_frame_time: string | null;
  error_message: string | null;
  camera_source?: string;
  zone_id?: number | null;
  connection_state?: string;
  frame_count?: number;
}

export interface CameraWithStatus {
  camera: Camera;
  status: CameraStatusInfo | null;
}

export interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: DetectionBox;
  center: [number, number];
}

export interface CameraPreview {
  camera_id: number;
  frame_base64: string;
  timestamp: string;
  detections: Detection[];
}

export interface WebcamDevice {
  index: number;
  label: string;
  source: string;
}

export interface DetectionEvent {
  id: number;
  camera_id: number;
  zone_id: number | null;
  detected_object: string;
  confidence: number;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  snapshot_path: string | null;
  review_status: ReviewStatus;
  created_at: string;
}

export interface DetectionEventWithDetails extends DetectionEvent {
  camera_name: string | null;
  zone_name: string | null;
}

export interface DetectionStats {
  total_detections: number;
  detections_today: number;
  detections_this_week: number;
  detections_this_month: number;
  pending_reviews: number;
  confirmed_detections: number;
  false_positives: number;
  avg_confidence: number;
  avg_duration_seconds: number;
  top_zones: Array<{ zone_name: string; count: number }>;
  top_cameras: Array<{ camera_name: string; count: number }>;
  detections_by_hour: Array<{ hour: number; count: number }>;
  detections_by_day: Array<{ date: string; count: number }>;
}

export interface ActiveDetectionSession {
  session_id: string;
  camera_id: number;
  zone_id: number | null;
  start_time: string;
  duration_seconds: number;
  max_confidence: number;
  detection_count: number;
  last_bbox: [number, number, number, number] | null;
}

export interface DetectionAlert {
  type: 'detection_alert';
  event_type: 'started' | 'updated' | 'ended';
  session_id: string;
  camera_id: number;
  zone_id: number | null;
  confidence: number;
  duration_seconds: number;
  detection_count: number;
  last_bbox: [number, number, number, number] | null;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DetectionEventFilters {
  page?: number;
  page_size?: number;
  camera_id?: number;
  zone_id?: number;
  review_status?: ReviewStatus;
  start_date?: string;
  end_date?: string;
  min_confidence?: number;
  search?: string;
  sort_by?: 'start_time' | 'duration';
  sort_order?: 'asc' | 'desc';
}

export interface HealthInfo {
  status: string;
  app_name: string;
  version: string;
  detector_loaded: boolean;
  active_cameras: number;
  monitoring_cameras: number;
  websocket_connections: number;
  active_detections: number;
}

export interface DetectionSettings {
  confidence_threshold: number;
  iou_threshold: number;
  interruption_tolerance: number;
  min_duration: number;
  snapshot_enabled: boolean;
  snapshot_dir: string;
  detector_loaded: boolean;
  target_class_name: string;
  target_class_id: number;
  model_path: string;
  device: string;
}

export interface CameraSettings {
  frame_width: number;
  frame_height: number;
  fps: number;
  buffer_size: number;
}

export interface ApplicationSettings {
  app_name: string;
  app_version: string;
  debug: boolean;
  database_url: string;
  snapshot_dir: string;
  export_dir: string;
}

export interface AppSettings {
  detection: DetectionSettings;
  camera: CameraSettings;
  application: ApplicationSettings;
}
