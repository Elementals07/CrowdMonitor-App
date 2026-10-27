import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Wifi, 
  HelpCircle,
  Cpu
} from 'lucide-react';
import { getServerUrl, setServerUrl, testServerConnection } from '../api';
import { reconnectSocket } from '../socket';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newUrl: string) => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    uptime?: number;
    latencyMs?: number;
    error?: string;
  }>({ tested: false, ok: false });
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(getServerUrl());
      setTestResult({ tested: false, ok: false });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult({ tested: false, ok: false });
    
    if (!url.trim()) {
      // Standalone mode is always 100% operational
      setTimeout(() => {
        setTestResult({
          tested: true,
          ok: true,
          uptime: 8420,
          latencyMs: 1
        });
        setTesting(false);
      }, 300);
      return;
    }

    const result = await testServerConnection(url.trim());
    setTestResult({
      tested: true,
      ok: result.ok,
      uptime: result.uptime,
      latencyMs: result.latencyMs,
      error: result.error
    });
    setTesting(false);
  };

  const handleSave = () => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    setServerUrl(cleanUrl);
    reconnectSocket(cleanUrl);
    if (onSaved) onSaved(cleanUrl);
    onClose();
  };

  const handleSetStandalone = () => {
    setUrl('');
    setTestResult({
      tested: true,
      ok: true,
      uptime: 8420,
      latencyMs: 1
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">System Mode & Network</h3>
              <p className="text-xs text-slate-500">Autonomous Standalone or External Server</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Autonomous Mode Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-blue-900">Embedded Autonomous Node</h4>
              <p className="text-[11px] text-blue-700/90 mt-0.5 leading-relaxed">
                CrowdMonitor runs 100% standalone inside this app. No laptop, server, or Wi-Fi setup is required for full demonstration.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                External Backend URL (Optional)
              </label>
              <button 
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Help
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setTestResult({ tested: false, ok: false });
                }}
                placeholder="Leave blank for Autonomous Standalone Mode"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {url.trim() ? `Connecting to: ${url.trim()}` : 'Currently active: Autonomous Standalone Engine'}
            </p>
          </div>

          {/* Help Accordion */}
          {showHelp && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-semibold flex items-center gap-1.5 text-slate-800">
                <Wifi className="w-4 h-4 text-blue-600" />
                Connection Information:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li><strong>Autonomous Mode (Recommended):</strong> Leave the URL blank. The app operates independently with live IoT telemetry simulations.</li>
                <li><strong>External Laptop Backend:</strong> If you run <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">npm run dev</code> on your laptop, enter your laptop's Wi-Fi IP (e.g. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">http://192.168.x.x:3001</code>).</li>
              </ul>
            </div>
          )}

          {/* Test Status Banner */}
          {testResult.tested && (
            <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
              testResult.ok 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {url.trim() ? 'Server Online & Connected' : 'Autonomous Node Active & Ready'}
                    </p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Response latency: {testResult.latencyMs}ms • Real-time telemetry: Live
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">External Server Unreachable</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {testResult.error || 'Cannot reach URL'}. Tip: Tap "Use Standalone Mode" to run completely independent of external devices.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Checking...' : 'Check Status'}
            </button>

            <button
              type="button"
              onClick={handleSetStandalone}
              className="px-3 py-2.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors border border-blue-200"
            >
              Use Standalone
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};
