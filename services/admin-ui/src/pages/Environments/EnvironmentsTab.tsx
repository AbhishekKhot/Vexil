import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Server, Copy, Check, AlertCircle, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';

interface Environment {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
}

interface OutletContext {
  projectId: string;
}

const ENV_COLOR_MAP: Record<string, string> = {
  production: 'bg-red-100 text-red-700 border-red-200',
  prod: 'bg-red-100 text-red-700 border-red-200',
  staging: 'bg-amber-100 text-amber-700 border-amber-200',
  stage: 'bg-amber-100 text-amber-700 border-amber-200',
  development: 'bg-green-100 text-green-700 border-green-200',
  dev: 'bg-green-100 text-green-700 border-green-200',
  test: 'bg-purple-100 text-purple-700 border-purple-200',
};

const getEnvColor = (name: string) =>
  ENV_COLOR_MAP[name.toLowerCase()] ?? 'bg-slate-100 text-slate-700 border-slate-200';

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="p-1.5 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all flex-shrink-0"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
};

export const EnvironmentsTab = () => {
  const { projectId } = useOutletContext<OutletContext>();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchEnvironments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/environments`);
      setEnvironments(res.data);
    } catch {
      setError('Failed to load environments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvironments();
  }, [projectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvName.trim()) return;
    try {
      setCreating(true);
      const res = await apiClient.post(`/projects/${projectId}/environments`, { name: newEnvName.trim() });
      setEnvironments((prev) => [...prev, res.data]);
      setShowModal(false);
      setNewEnvName('');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create environment.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the environment "${name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/projects/${projectId}/environments/${id}`);
      setEnvironments((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete environment.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Environments</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage deployment targets and their SDK keys.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Environment
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 flex items-center gap-2 border border-red-100 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
        </div>
      ) : environments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-100 py-16">
          <Server className="w-14 h-14 mb-4 opacity-40" />
          <p className="text-lg font-semibold">No Environments Yet</p>
          <p className="text-sm mt-1">Create your first environment (e.g. Development, Staging, Production).</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto">
          {environments.map((env) => (
            <div
              key={env.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow group relative"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border text-sm font-bold uppercase ${getEnvColor(env.name)}`}>
                    {env.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{env.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getEnvColor(env.name)}`}>
                        {env.name.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Created {new Date(env.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDelete(env.id, env.name)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Environment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* SDK Key Section */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SDK Client Key</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-xs text-slate-700 font-mono truncate">{env.apiKey}</code>
                  <CopyButton text={env.apiKey} />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Use this key in your SDK configuration to connect to this environment.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">New Environment</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-3">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Environment Name</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. development, staging, production"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50 text-sm"
                />
              </div>
              <p className="text-xs text-slate-400 mb-6">An SDK key will be generated automatically.</p>
              {/* Suggestions */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {['development', 'staging', 'production', 'test'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewEnvName(s)}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-700 transition-colors font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setNewEnvName(''); }}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? 'Creating...' : 'Create Environment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
