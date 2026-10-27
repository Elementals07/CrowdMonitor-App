import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  Clock,
  Bell,
  FileText,
  Settings,
  Menu,
  X,
  Activity,
  ExternalLink
} from 'lucide-react';
import { socket } from '../../socket';
import { api, MqttStatus } from '../../api';
import { StatusDot } from '../ui/StatusDot';
import clsx from 'clsx';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Layout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAlertCount, setOpenAlertCount] = useState<number>(0);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>({
    connected: false,
    lastMessageAt: null,
    reconnectCount: 0,
    broker: '',
  });
  const [isStale, setIsStale] = useState<boolean>(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;

    async function initData() {
      try {
        const [currentRes, openAlertsRes] = await Promise.all([
          api.getCurrentOccupancy().catch(() => null),
          api.getOpenAlerts().catch(() => null),
        ]);

        if (isMounted) {
          if (currentRes?.data) {
            setMqttStatus(currentRes.data.mqtt);
            setIsStale(currentRes.data.isStale);
          }
          if (openAlertsRes?.data) {
            setOpenAlertCount(openAlertsRes.data.length);
          }
        }
      } catch (err) {
        console.error('Error fetching initial layout data', err);
      }
    }

    initData();

    // Socket listeners
    const handleMqttStatus = (data: MqttStatus) => {
      setMqttStatus(data);
    };

    const handleAlertNew = () => {
      setOpenAlertCount((prev) => prev + 1);
    };

    const handleOccupancyUpdate = (data: any) => {
      if (data?.ts) {
        setMqttStatus((prev) => ({
          ...prev,
          lastMessageAt: data.ts,
          connected: true,
        }));
        setIsStale(false);
      }
    };

    socket.on('mqtt:status', handleMqttStatus);
    socket.on('alert:new', handleAlertNew);
    socket.on('occupancy:update', handleOccupancyUpdate);

    return () => {
      isMounted = false;
      socket.off('mqtt:status', handleMqttStatus);
      socket.off('alert:new', handleAlertNew);
      socket.off('occupancy:update', handleOccupancyUpdate);
    };
  }, []);

  const navGroups: NavGroup[] = [
    {
      group: 'LIVE OPERATIONS',
      items: [
        { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
        { label: 'Live Monitor', to: '/admin/live', icon: Radio },
      ],
    },
    {
      group: 'FLOW & SESSIONS',
      items: [
        { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
        { label: 'Sessions', to: '/admin/sessions', icon: Clock },
      ],
    },
    {
      group: 'GOVERNANCE & EXPORTS',
      items: [
        {
          label: 'Alerts',
          to: '/admin/alerts',
          icon: Bell,
          badge: openAlertCount > 0 ? openAlertCount : undefined,
        },
        { label: 'Reports', to: '/admin/reports', icon: FileText },
        { label: 'Settings', to: '/admin/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between bg-[#0B0F19] text-white px-4 py-3.5 border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block leading-tight">CrowdMonitor</span>
            <span className="text-[10px] text-slate-400 font-mono">Console Admin</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <StatusDot connected={mqttStatus.connected} stale={isStale} size="sm" />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 bg-[#0B0F19] text-slate-300 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen md:sticky md:top-0 border-r border-slate-800/80 shadow-2xl',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* App Logo / Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-white font-extrabold text-base tracking-tight leading-none">CrowdMonitor</h1>
              </div>
              <span className="text-[11px] text-blue-400 font-mono font-medium">Enterprise Console</span>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.group}>
              <div className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono mb-2">
                {group.group}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end || item.to === '/admin'}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group relative',
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3">
                            <Icon className={clsx(
                              'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                            )} />
                            <span>{item.label}</span>
                          </div>

                          {item.badge !== undefined && (
                            <span
                              className={clsx(
                                'px-2 py-0.5 text-[10px] font-mono font-bold rounded-full',
                                item.badge > 0
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}

                          {isActive && (
                            <span className="absolute -left-3 top-2 bottom-2 w-1 bg-blue-400 rounded-r-full" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Switch to Public Portal Shortcut Button */}
        <div className="px-3.5 pb-3">
          <NavLink
            to="/"
            className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-blue-400 group-hover:rotate-45 transition-transform" />
              <span>Public Visitor View</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">ROOM-101</span>
          </NavLink>
        </div>

        {/* Hardware Telemetry Signal Box */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <StatusDot connected={mqttStatus.connected} stale={isStale} size="sm" />
              <span className="text-xs font-bold text-slate-200">
                {mqttStatus.connected
                  ? isStale
                    ? 'Feed Stale'
                    : 'ESP8266 Online'
                  : 'Hardware Offline'}
              </span>
            </div>
            
            {mqttStatus.connected && !isStale && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                TLS 8883
              </span>
            )}
          </div>
          
          <p className="text-[10px] text-slate-500 truncate font-mono">
            {mqttStatus.lastMessageAt
              ? `Frame: ${new Date(mqttStatus.lastMessageAt).toLocaleTimeString()}`
              : 'Awaiting device stream'}
          </p>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
