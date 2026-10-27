import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Wifi, 
  HelpCircle 
} from 'lucide-react';
import { getServerUrl, setServerUrl, DEFAULT_SERVER_URL, testServerConnection } from '../api';
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
      setUrl(getServerUrl() || DEFAULT_SERVER_URL);
      setTestResult({ tested: false, ok: false });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult({ tested: false, ok: false });
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

  const handleResetDefault = () => {
    setUrl(DEFAULT_SERVER_URL);
    setTestResult({ tested: false, ok: false });
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
              <h3 className="text-base font-bold text-slate-900">Server Connection</h3>
              <p className="text-xs text-slate-500">Configure backend server address</p>
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Backend API & WebSocket URL
              </label>
              <button 
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Help / How it works
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
                placeholder="http://10.124.148.23:3001"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Help Accordion */}
          {showHelp && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-blue-600" />
                How to connect your phone to your PC:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-700">
                <li>Make sure your phone and PC are connected to the <strong>same Wi-Fi network</strong> (or phone hotspot).</li>
                <li>Ensure the backend is running on your PC: in terminal, run <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono">cd server && npm run dev</code>.</li>
                <li>On your PC, open cmd and type <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono">ipconfig</code> to see your IPv4 address.</li>
                <li>Enter <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono">http://&lt;your-pc-ip&gt;:3001</code> here.</li>
              </ol>
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
                    <p className="font-semibold">Successfully connected!</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Response time: {testResult.latencyMs}ms • Server Uptime: {Math.floor(testResult.uptime || 0)}s
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Connection Failed</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {testResult.error || 'Cannot reach server'}. Verify the backend is running on your PC and both devices share the same Wi-Fi.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !url.trim()}
              className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Reset Default
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
            disabled={!url.trim()}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};
