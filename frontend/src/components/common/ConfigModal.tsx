import React, { useState } from 'react';
import { Check, RefreshCw, Server, X } from 'lucide-react';
import { getActiveBaseUrl, getApiPrefix, setCustomBaseUrl } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const { notify } = useNotification();
  const [urlInput, setUrlInput] = useState(getActiveBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    setCustomBaseUrl(urlInput);
    notify('success', `API Base URL updated to: ${urlInput || '(default origin)'}`);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const prefix = urlInput ? `${urlInput.replace(/\/+$/, '')}/api/v1` : '/api/v1';
      const res = await fetch(`${prefix}/health`, { method: 'GET' });
      if (res.ok) {
        setTestResult(`Success: Backend responded with ${res.status}`);
        notify('success', 'Backend reachable!');
      } else {
        setTestResult(`Received status ${res.status} from ${prefix}/health`);
      }
    } catch (err: any) {
      setTestResult(`Connection failed: ${err.message || 'Network error'}`);
      notify('error', 'Could not connect to backend server at that address');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Backend API Gateway</h3>
            <p className="text-xs text-slate-400">Configure connection to your actual backend server</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              API Base URL (<span className="font-mono text-slate-400">VITE_API_BASE_URL</span>)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="e.g. http://localhost:8000 or http://127.0.0.1:8000"
                className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={handleSaveUrl}
                className="px-3.5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Active endpoint prefix: <span className="font-mono text-indigo-400">{getApiPrefix()}</span>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
            {testResult && (
              <span className="text-[11px] font-mono text-slate-400 max-w-xs truncate">
                {testResult}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
