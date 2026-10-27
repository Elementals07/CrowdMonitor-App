import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Eye, 
  ArrowRight, 
  Activity, 
  KeyRound, 
  AlertCircle, 
  Cpu, 
  Lock, 
  Layers, 
  CheckCircle2,
  Server
} from 'lucide-react';
import { api, getServerUrl } from '../api';
import { ServerSettingsModal } from '../components/ServerSettingsModal';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Server Settings Modal State
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [currentServer, setCurrentServer] = useState(getServerUrl());

  // User Sensor Lookup State
  const [sensorCode, setSensorCode] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Admin Login State
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const demoRooms = [
    { code: 'ROOM-101', name: 'Main Conference Hall', live: true },
  ];

  const handleLookup = async (e?: React.FormEvent, customCode?: string) => {
    if (e) e.preventDefault();
    const code = (customCode || sensorCode).trim().toUpperCase();
    if (!code) {
      setLookupError('Please enter a sensor code to continue');
      return;
    }

    try {
      setIsLookingUp(true);
      setLookupError('');
      await api.getPublicSensorStatus(code);
      navigate(`/view/${code}`);
    } catch (err: any) {
      setLookupError(err.message || `Sensor '${code}' not found. Please try code: ROOM-101`);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser.trim() || !adminPass.trim()) {
      setLoginError('Please enter both username and password');
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginError('');
      const res = await api.adminLogin({ username: adminUser.trim(), password: adminPass });
      if (res.data?.authenticated) {
        localStorage.setItem('crowd_admin_auth', 'true');
        if (res.data?.token) {
          localStorage.setItem('crowd_admin_token', res.data.token);
        }
        navigate('/admin');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Invalid credentials. Default: admin / admin123');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickDemoFill = () => {
    setAdminUser('admin');
    setAdminPass('admin123');
    setLoginError('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col selection:bg-blue-500/20 selection:text-blue-900">
      
      {/* Top Navigation Bar */}
      <header className="w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">CrowdMonitor</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  IoT Platform
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">Real-Time Occupancy Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* System Mode Pill */}
            <button
              type="button"
              onClick={() => setServerModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs text-slate-700 transition-colors shadow-xs"
              title="Configure Network / Autonomous Mode"
            >
              <Server className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-mono text-[11px] max-w-[100px] truncate">
                {currentServer ? 'Remote' : 'Autonomous'}
              </span>
            </button>

            {/* Status Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-[11px]">System Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Headline */}
      <main className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Smart Crowd Monitoring.{' '}
            <span className="text-blue-600">Real-Time.</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed">
            Check room availability as a visitor, or log in to the admin dashboard for full capacity control and analytics.
          </p>
        </div>

        {/* Dual Portal Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          
          {/* SECTION 1: PUBLIC USER PORTAL */}
          <div className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-lg transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 text-xs font-semibold uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5" />
                  Visitor Portal
                </span>
                <span className="text-[11px] text-slate-400 font-medium">No Login Required</span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1.5">Check Room Occupancy</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Enter your room code to view live headcount, available space, and safety status.
              </p>

              {/* Form */}
              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Sensor / Room Code
                  </label>
                  <input
                    type="text"
                    value={sensorCode}
                    onChange={(e) => {
                      setSensorCode(e.target.value.toUpperCase());
                      setLookupError('');
                    }}
                    placeholder="e.g. ROOM-101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm tracking-wider transition-all"
                  />

                  {lookupError && (
                    <div className="mt-2.5 text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                        <span>{lookupError}</span>
                      </div>
                      {lookupError.toLowerCase().includes('server') && (
                        <button
                          type="button"
                          onClick={() => setServerModalOpen(true)}
                          className="text-blue-600 underline font-semibold hover:text-blue-700 block text-[11px] pt-0.5"
                        >
                          ⚙️ Open Server Settings to verify IP & Port
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLookingUp}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold py-3 px-5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isLookingUp ? 'Validating...' : 'View Crowd Status'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Quick Select */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
                Quick Select:
              </span>
              <div className="flex flex-wrap gap-2">
                {demoRooms.map((room) => (
                  <button
                    key={room.code}
                    type="button"
                    onClick={() => {
                      setSensorCode(room.code);
                      handleLookup(undefined, room.code);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    <span className="font-mono font-bold text-blue-600">{room.code}</span>
                    <span className="text-slate-400">({room.name})</span>
                    {room.live && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: ADMIN MANAGEMENT PORTAL */}
          <div className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-lg transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 text-xs font-semibold uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />
                  Admin Portal
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Secured Access</span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1.5">Facility Operator Login</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Access capacity control, traffic analytics, alerts, and export tools.
              </p>

              {/* Form */}
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={adminUser}
                    onChange={(e) => {
                      setAdminUser(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="admin"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={adminPass}
                    onChange={(e) => {
                      setAdminPass(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all"
                  />

                  {loginError && (
                    <div className="mt-2.5 text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                        <span>{loginError}</span>
                      </div>
                      {loginError.toLowerCase().includes('server') && (
                        <button
                          type="button"
                          onClick={() => setServerModalOpen(true)}
                          className="text-purple-700 underline font-semibold hover:text-purple-800 block text-[11px] pt-0.5"
                        >
                          ⚙️ Open Server Settings to verify IP & Port
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-semibold py-3 px-5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  {isLoggingIn ? 'Verifying...' : 'Login to Dashboard'}
                </button>
              </form>
            </div>

            {/* Quick Fill Helper */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Demo: <code className="text-purple-600 font-mono font-medium bg-purple-50 px-1.5 py-0.5 rounded">admin / admin123</code>
              </span>
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="text-purple-600 hover:text-purple-700 font-medium hover:underline cursor-pointer"
              >
                Auto-Fill
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights Bar */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Hardware Sync</div>
              <div className="text-[11px] text-slate-500">IR sensors via ESP8266</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Auto Gate Control</div>
              <div className="text-[11px] text-slate-500">Servo & buzzer on capacity breach</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Rich Analytics</div>
              <div className="text-[11px] text-slate-500">Time-series, heatmaps & CSV exports</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CrowdMonitor IoT System • NodeMCU ESP8266</span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            HiveMQ Cloud Connected
          </span>
        </div>
      </footer>

      {/* Server Settings Modal */}
      <ServerSettingsModal 
        isOpen={serverModalOpen} 
        onClose={() => setServerModalOpen(false)} 
        onSaved={(newUrl) => setCurrentServer(newUrl)}
      />
    </div>
  );
};
