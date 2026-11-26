import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  MonitorPlay,
  Settings as SettingsIcon,
  ShieldAlert,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Toasts } from './ui';

const navigation = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Live Monitoring', href: '/live', icon: MonitorPlay },
  { name: 'Zone Management', href: '/zones', icon: MapPin },
  { name: 'Camera Management', href: '/cameras', icon: Video },
  { name: 'Detection History', href: '/detections', icon: History },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${online ? 'bg-success-400' : 'bg-danger-400'}`}
    />
  );
}

export function Layout() {
  const { wsConnected, activeDetections, stats } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount = activeDetections.length;
  const pendingReviews = stats?.pending_reviews ?? 0;

  return (
    <div className="min-h-screen bg-ink-950">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-ink-900 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 flex-none items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600/15 text-primary-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-100">Smart Surveillance</p>
              <p className="text-[11px] text-mute">Phone Detection System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="btn-icon lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
          <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Workspace
          </p>
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <item.icon className="h-4 w-4 flex-none" />
              <span className="truncate">{item.name}</span>
              {item.href === '/live' && activeCount > 0 && (
                <span className="ml-auto rounded bg-danger-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-danger-300">
                  {activeCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-none border-t border-line p-3">
          {activeCount > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-danger-500/30 bg-danger-500/10 px-2.5 py-2 text-xs text-danger-300">
              <Activity className="h-3.5 w-3.5 flex-none" />
              <span>
                {activeCount} active detection{activeCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {pendingReviews > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-warning-500/25 bg-warning-500/10 px-2.5 py-2 text-xs text-warning-400">
              <History className="h-3.5 w-3.5 flex-none" />
              <span>{pendingReviews} pending review</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-mute">
            {wsConnected ? <Wifi className="h-3.5 w-3.5 text-success-400" /> : <WifiOff className="h-3.5 w-3.5 text-danger-400" />}
            <StatusDot online={wsConnected} />
            <span>{wsConnected ? 'Realtime connected' : 'Realtime offline'}</span>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-ink-950/90 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="btn-icon lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2 text-xs text-mute sm:flex">
              <StatusDot online={wsConnected} />
              <span>{wsConnected ? 'Live channel active' : 'Attempting to reconnect'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-line bg-ink-900 px-2.5 py-1.5 text-xs text-slate-400 sm:flex">
              <Activity className="h-3.5 w-3.5 text-primary-400" />
              <span className="tabular-nums">{activeCount}</span>
              <span className="text-mute">active</span>
            </div>
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-750 text-[11px] font-semibold text-slate-300">
                AD
              </div>
              <span className="hidden text-sm font-medium text-slate-300 sm:block">Administrator</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
