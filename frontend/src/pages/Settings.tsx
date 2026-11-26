import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings as SettingsIcon,
  Cpu,
  Eye,
  Shield,
  Database,
  Download,
  Upload,
  RotateCcw,
  Loader2,
  Save,
  CheckCircle,
  Video,
} from 'lucide-react';

export function Settings() {
  const { detectorInfo } = useApp();
  const [activeTab, setActiveTab] = useState<'detection' | 'camera' | 'system' | 'data'>('detection');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs = [
    { id: 'detection', label: 'Detection', icon: Eye },
    { id: 'camera', label: 'Camera', icon: Cpu },
    { id: 'system', label: 'System', icon: SettingsIcon },
    { id: 'data', label: 'Data', icon: Database },
  ];

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const localDetectorInfo = detectorInfo || {
    model_path: 'yolov8n.pt',
    device: 'cpu',
    confidence_threshold: 0.5,
    iou_threshold: 0.45,
    target_class_id: 67,
    target_class_name: 'cell phone',
    is_loaded: true,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure detection, cameras, and system settings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {saved && (
        <div className="bg-success-50 border border-success-200 text-success-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Settings saved successfully
        </div>
      )}

      {/* Tab Navigation */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex gap-8 px-6" aria-label="Settings tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Detection Settings */}
          {activeTab === 'detection' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">YOLO Model Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Model Path</label>
                    <input
                      type="text"
                      value={localDetectorInfo.model_path}
                      className="input font-mono"
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">Place custom models in the models directory</p>
                  </div>
                  <div>
                    <label className="label">Device</label>
                    <select className="input" defaultValue={localDetectorInfo.device}>
                      <option value="cpu">CPU</option>
                      <option value="cuda">CUDA (GPU)</option>
                      <option value="mps">MPS (Apple Silicon)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Confidence Threshold</label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      defaultValue={localDetectorInfo.confidence_threshold}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>0.1</span>
                      <span className="font-medium">{localDetectorInfo.confidence_threshold}</span>
                      <span>0.9</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">IoU Threshold</label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      defaultValue={localDetectorInfo.iou_threshold}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>0.1</span>
                      <span className="font-medium">{localDetectorInfo.iou_threshold}</span>
                      <span>0.9</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detection Target</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Target Class ID</label>
                    <input
                      type="number"
                      defaultValue={localDetectorInfo.target_class_id}
                      className="input"
                      min="0"
                      max="79"
                    />
                    <p className="text-xs text-gray-500 mt-1">COCO class ID (67 = cell phone)</p>
                  </div>
                  <div>
                    <label className="label">Target Class Name</label>
                    <input
                      type="text"
                      defaultValue={localDetectorInfo.target_class_name}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Interruption Tolerance (seconds)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      defaultValue="2.0"
                      className="input"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max gap before ending a detection session</p>
                  </div>
                  <div>
                    <label className="label">Minimum Duration (seconds)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="30"
                      defaultValue="1.0"
                      className="input"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum session duration to save as event</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Snapshots</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Save detection snapshots</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Draw bounding boxes on snapshots</span>
                  </label>
                  <div>
                    <label className="label">Snapshot Directory</label>
                    <input type="text" value="./snapshots" className="input font-mono" readOnly />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Camera Settings */}
          {activeTab === 'camera' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Camera Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Frame Width</label>
                    <input type="number" defaultValue="640" className="input" min="320" max="1920" step="32" />
                  </div>
                  <div>
                    <label className="label">Frame Height</label>
                    <input type="number" defaultValue="480" className="input" min="240" max="1080" step="24" />
                  </div>
                  <div>
                    <label className="label">Target FPS</label>
                    <input type="number" defaultValue="30" className="input" min="1" max="60" />
                  </div>
                  <div>
                    <label className="label">Buffer Size</label>
                    <input type="number" defaultValue="1" className="input" min="1" max="10" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Stream Formats</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Video className="h-5 w-5 text-primary-600" />
                    <span>Local webcam (device index: 0, 1, ...)</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Video className="h-5 w-5 text-primary-600" />
                    <span>RTSP streams (rtsp://user:pass@ip:port/stream)</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Video className="h-5 w-5 text-primary-600" />
                    <span>HTTP/MJPEG streams (http://ip:port/video)</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Video className="h-5 w-5 text-primary-600" />
                    <span>Video files (MP4, AVI, MOV, etc.)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Application</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Auto-refresh dashboard (5s interval)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Enable sound alerts for detections</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Show bounding boxes in previews</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">Dark mode</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">WebSocket</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Ping Interval (seconds)</label>
                    <input type="number" defaultValue="30" className="input" min="10" max="120" />
                  </div>
                  <div>
                    <label className="label">Ping Timeout (seconds)</label>
                    <input type="number" defaultValue="10" className="input" min="5" max="60" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Security</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Shield className="h-5 w-5 text-success-600" />
                    <span>No face recognition or identity tracking</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Shield className="h-5 w-5 text-success-600" />
                    <span>No continuous video recording</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Shield className="h-5 w-5 text-success-600" />
                    <span>Local camera processing only</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Shield className="h-5 w-5 text-success-600" />
                    <span>Human review required before action</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Shield className="h-5 w-5 text-success-600" />
                    <span>Configurable detection confidence</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Settings */}
          {activeTab === 'data' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Export</h3>
                <div className="flex flex-wrap gap-4">
                  <button className="btn-outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export All Detections (CSV)
                  </button>
                  <button className="btn-outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Pending Reviews (CSV)
                  </button>
                  <button className="btn-outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Confirmed Detections (CSV)
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Import</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="btn-outline cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Zones (JSON)
                    <input type="file" accept=".json" className="sr-only" />
                  </label>
                  <label className="btn-outline cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Cameras (JSON)
                    <input type="file" accept=".json" className="sr-only" />
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Management</h3>
                <div className="flex flex-wrap gap-4">
                  <button className="btn-outline text-danger-600 border-danger-200 hover:bg-danger-50">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Detection Events
                  </button>
                  <button className="btn-outline text-danger-600 border-danger-200 hover:bg-danger-50">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset All Data
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Warning: These actions cannot be undone. Export data before resetting.
                </p>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Database Size</p>
                    <p className="text-2xl font-bold text-gray-900">~2.4 MB</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Snapshots</p>
                    <p className="text-2xl font-bold text-gray-900">~15 MB</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Exports</p>
                    <p className="text-2xl font-bold text-gray-900">~500 KB</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}