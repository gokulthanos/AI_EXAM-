import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { Zones } from './pages/Zones';
import { Cameras } from './pages/Cameras';
import { DetectionEvents } from './pages/DetectionEvents';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="live" element={<LiveMonitoring />} />
          <Route path="zones" element={<Zones />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="detections" element={<DetectionEvents />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="dashboard" element={<Navigate to="/overview" replace />} />
          <Route path="detection-events" element={<Navigate to="/detections" replace />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default App;
