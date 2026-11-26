# Smart Surveillance – AI Mobile Phone Detection System

An AI-powered surveillance system that detects mobile phones in restricted areas such as examination halls, classrooms, libraries, temples, churches, and other restricted zones.

## Features

- **Real-time Mobile Phone Detection**: Uses YOLOv8 to detect cell phones (COCO class 67) from live camera feeds
- **Multi-Camera Support**: Manage multiple cameras with webcam, RTSP, HTTP stream, and video file sources
- **Zone Management**: Organize cameras into restricted zones (exam halls, libraries, etc.)
- **Continuous Detection Tracking**: Tracks continuous phone visibility sessions with configurable interruption tolerance
- **Detection Events**: Records start/end times, duration, confidence, and optional snapshots
- **Review Workflow**: Human review system (Pending → Confirmed/False Positive/Dismissed)
- **Real-time WebSocket Updates**: Live detection alerts, camera status, and active sessions
- **Analytics Dashboard**: Statistics, charts, and CSV export
- **Privacy-Focused**: No face recognition, no identity tracking, no continuous recording
- **Single-Command Startup**: `python run.py` starts both backend and frontend

## Technology Stack

### Backend
- **Python 3.10+**
- **FastAPI** - Modern async web framework
- **OpenCV** - Camera processing and frame handling
- **YOLOv8 (Ultralytics)** - Object detection model
- **SQLAlchemy** - ORM with SQLite
- **Pydantic** - Data validation
- **WebSockets** - Real-time communication

### Frontend
- **React 18** with TypeScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Axios** - HTTP client
- **React Router** - Navigation

## Project Structure

```
smart-surveillance/
├── backend/
│   ├── app/
│   │   ├── configuration/     # Settings and configuration
│   │   ├── database/          # Database connection and models
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Business logic services
│   │   ├── ai_detection/      # YOLO detector and session tracker
│   │   ├── camera_processing/ # Camera manager
│   │   ├── websocket/         # WebSocket manager and routes
│   │   ├── routes/            # REST API routes
│   │   └── main.py            # FastAPI application entry point
│   ├── requirements.txt
│   ├── .env
│   └── test_backend.py
└── frontend/
    ├── src/
    │   ├── components/        # Reusable UI components
    │   ├── pages/             # Page components
    │   ├── hooks/             # Custom React hooks
    │   ├── services/          # API and WebSocket services
    │   ├── context/           # React context providers
    │   ├── types/             # TypeScript types
    │   └── utils/             # Utility functions
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

## Quick Start

### Single-Command Startup (Recommended)

```bash
# From the project root directory
python run.py
```

This single command will:
1. Check Python and Node.js prerequisites
2. Create Python virtual environment if needed
3. Install all Python dependencies (auto-installs on first run)
4. Install all Node.js dependencies (auto-installs on first run)
5. Initialize the SQLite database
6. Start the FastAPI backend on http://localhost:8000
7. Start the React Vite frontend on http://localhost:5173
8. Open the frontend in your default browser

**Stop the application**: Press `Ctrl+C` in the terminal - both servers will shut down cleanly.

### Prerequisites
- Python 3.10+
- Node.js 18+
- Webcam or IP camera

### Manual Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# The YOLOv8n model will auto-download on first run (~6MB)

# Run the backend
python -m app.main
# Or with uvicorn directly:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- WebSocket: ws://localhost:8000/ws

### Manual Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend will be available at http://localhost:5173

## Configuration

### Backend (.env)

```env
# Application
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=sqlite:///./smart_surveillance.db

# YOLO Model
YOLO_MODEL_PATH=yolov8n.pt
YOLO_CONFIDENCE_THRESHOLD=0.5
YOLO_IOU_THRESHOLD=0.45
YOLO_DEVICE=cpu
DETECTION_TARGET_CLASS=cell phone
DETECTION_TARGET_CLASS_ID=67

# Camera
DEFAULT_CAMERA_INDEX=0
CAMERA_FRAME_WIDTH=640
CAMERA_FRAME_HEIGHT=480
CAMERA_FPS=30

# Detection Logic
DETECTION_INTERRUPTION_TOLERANCE_SECONDS=2.0
DETECTION_MIN_DURATION_SECONDS=1.0
DETECTION_SNAPSHOT_ENABLED=true
DETECTION_SNAPSHOT_DIR=./snapshots
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000
```

## API Endpoints

### Zones
- `GET /api/zones/` - List zones
- `POST /api/zones/` - Create zone
- `GET /api/zones/{id}` - Get zone
- `PUT /api/zones/{id}` - Update zone
- `DELETE /api/zones/{id}` - Delete zone
- `GET /api/zones/stats` - Zones with statistics

### Cameras
- `GET /api/cameras/` - List cameras
- `POST /api/cameras/` - Create camera
- `GET /api/cameras/{id}` - Get camera
- `PUT /api/cameras/{id}` - Update camera
- `DELETE /api/cameras/{id}` - Delete camera
- `GET /api/cameras/{id}/status` - Real-time camera status
- `GET /api/cameras/{id}/preview` - Preview frame with detections
- `POST /api/cameras/{id}/connect` - Connect to camera
- `POST /api/cameras/{id}/disconnect` - Disconnect camera
- `POST /api/cameras/{id}/start-monitoring` - Start detection monitoring
- `POST /api/cameras/{id}/stop-monitoring` - Stop monitoring

### Detection Events
- `GET /api/detection-events/` - List detection events (paginated, filterable)
- `GET /api/detection-events/stats` - Detection statistics
- `GET /api/detection-events/active` - Currently active detections
- `GET /api/detection-events/{id}` - Get event details
- `PUT /api/detection-events/{id}` - Update event
- `PUT /api/detection-events/{id}/review` - Update review status
- `DELETE /api/detection-events/{id}` - Delete event
- `GET /api/detection-events/export/csv` - Export to CSV

### WebSocket
- `WS /ws?client_id={id}` - Real-time connection
- Messages: subscribe, unsubscribe, get_active_detections, get_camera_status, start_monitoring, stop_monitoring, update_detection_config

## Detection Logic

The system uses a **session-based detection tracker** to avoid duplicate events:

1. **Phone Appears**: Creates active detection session, records start time
2. **Phone Visible**: Updates session with max confidence, detection count, bounding box
3. **Phone Disappears**: Waits for `interruption_tolerance` (default 2s)
4. **Timeout**: If phone doesn't reappear, ends session and saves event (if duration ≥ `min_duration`)

This prevents brief occlusions from creating multiple events for the same continuous detection.

## Privacy & Compliance

- ✅ No face recognition
- ✅ No identity tracking
- ✅ No continuous video recording
- ✅ Optional detection snapshots only
- ✅ Local camera processing
- ✅ Configurable confidence thresholds
- ✅ Human review required before action
- ✅ Data stored locally (SQLite)

## Custom Model Training

To use a custom-trained YOLO model:

1. Train your model using Ultralytics YOLOv8
2. Place the `.pt` file in the backend directory
3. Update `YOLO_MODEL_PATH` in `.env`
4. If your model uses different class IDs, update `DETECTION_TARGET_CLASS_ID`

## Development

### Running Tests

```bash
cd backend
python test_backend.py
```

### Database Migrations

```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## Production Deployment

### Backend
- Use Gunicorn with Uvicorn workers: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`
- Set `DEBUG=false` in .env
- Use PostgreSQL instead of SQLite for production
- Configure proper CORS origins
- Use HTTPS/WSS in production

### Frontend
- Build: `npm run build`
- Serve static files with Nginx
- Configure reverse proxy to backend API/WebSocket

## Troubleshooting

### Single-Command Startup Issues

#### `python run.py --check-only`
Run this first to diagnose issues without starting servers:
```bash
python run.py --check-only
```

Common issues and fixes:
- **Python version**: Ensure Python 3.10+ is installed and in PATH
- **Node.js not found**: Install Node.js 18+ from nodejs.org
- **Virtual environment**: Run `python run.py` again - it will auto-create venv and install deps
- **Dependencies failing**: Check internet connection; some packages (torch, ultralytics) are large
- **Port already in use**: Use `python run.py --port 8001` for a different backend port

#### `python run.py --backend-only`
Start only the backend (useful for API testing):
```bash
python run.py --backend-only
```

#### `python run.py --frontend-only`
Start only the frontend (requires backend already running):
```bash
python run.py --frontend-only
```

#### `python run.py --no-browser`
Skip auto-opening browser:
```bash
python run.py --no-browser
```

### Camera Not Connecting
- Check camera index (try 0, 1, 2...)
- For RTSP: verify URL format and network access
- Check OpenCV backend: `cv2.CAP_DSHOW` on Windows

### YOLO Model Not Loading
- First run downloads model automatically (~6MB)
- Check internet connection
- Verify `YOLO_MODEL_PATH` in .env

### Low Detection Accuracy
- Increase `YOLO_CONFIDENCE_THRESHOLD`
- Ensure good lighting
- Camera should be positioned to capture phone screens
- Consider custom training for your environment

### Frontend Build Errors
- Run `cd frontend && npm install` to reinstall dependencies
- Clear Vite cache: `cd frontend && rm -rf node_modules/.vite && npm run dev`
- Check Node.js version: `node --version` (must be 18+)

### Database Errors
- Delete `backend/smart_surveillance.db` and restart - it will recreate
- Check file permissions on backend directory

### WebSocket Connection Issues
- Ensure backend is running on port 8000
- Check browser console for CORS/WS errors
- Try `python run.py --check-only` to verify backend health endpoint

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## Support

For issues and feature requests, please open a GitHub issue.