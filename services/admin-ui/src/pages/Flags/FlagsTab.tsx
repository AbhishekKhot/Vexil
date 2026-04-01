import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Plus, Flag, AlertCircle, Loader2, Tag, ToggleLeft, ArrowRight, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../utils/cn';

interface Flag {
  id: string;
  key: string;
  description?: string;
  type: string;
  createdAt: string;
}

interface OutletContext {
  projectId: string;
}

const FLAG_TYPE_STYLES: Record<string, string> = {
  boolean: 'bg-blue-50 text-blue-700 border-blue-200',
  string: 'bg-green-50 text-green-700 border-green-200',
  number: 'bg-amber-50 text-amber-700 border-amber-200',
  json: 'bg-purple-50 text-purple-700 border-purple-200',
};

const FLAG_TYPES = ['boolean', 'string', 'number', 'json'];

export const FlagsTab = () => {
  const { projectId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ key: '', description: '', type: 'boolean' });
  const [creating, setCreating] = useState(false);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/flags`);
      setFlags(res.data);
    } catch {
      setError('Failed to load flags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [projectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key.trim()) return;
    try {
      setCreating(true);
      const res = await apiClient.post(`/projects/${projectId}/flags`, {
        key: form.key.trim().toLowerCase().replace(/\s+/g, '-'),
        type: form.type,
        description: form.description,
      });
      setFlags((prev) => [...prev, res.data]);
      setShowModal(false);
      setForm({ key: '', description: '', type: 'boolean' });
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create flag.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, key: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the flag "${key}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/projects/${projectId}/flags/${id}`);
      setFlags((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete flag.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Feature Flags</h2>
          <p className="text-sm text-slate-500 mt-0.5">Define flags and configure them per environment on the toggle board.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Flag
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
      ) : flags.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-100 py-16">
          <Flag className="w-14 h-14 mb-4 opacity-40" />
          <p className="text-lg font-semibold">No Flags Defined</p>
          <p className="text-sm mt-1">Create your first feature flag to start controlling your features.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Hint to navigate */}
          <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 rounded-xl px-4 py-2.5 text-xs font-medium">
            <ToggleLeft className="w-4 h-4" />
            Click a flag to open the environment toggle board and configure rules.
          </div>
          {flags.map((flag) => (
            <button
              key={flag.id}
              onClick={() => navigate(`/projects/${projectId}/flags/${flag.id}/configure`)}
              className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-primary-200 transition-all group flex items-center gap-4 relative"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 transition-colors">
                <Tag className="w-5 h-5 text-slate-500 group-hover:text-primary-600 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-slate-900">{flag.key}</span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', FLAG_TYPE_STYLES[flag.type] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                    {flag.type}
                  </span>
                </div>
                {flag.description && (
                  <p className="text-sm text-slate-500 mt-0.5 truncate">{flag.description}</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">
                  Created {new Date(flag.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(e, flag.id, flag.key)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Flag"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Flag Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Flag className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">New Feature Flag</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Flag Key</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. new-search-v2, dark-mode-enable"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 font-mono text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, and hyphens only.</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Flag Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {FLAG_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={cn(
                        'py-2 rounded-lg text-xs font-semibold border transition-all',
                        form.type === t
                          ? FLAG_TYPE_STYLES[t] ?? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description <span className="text-slate-400 font-normal">(Optional)</span></label>
                <textarea
                  rows={2}
                  placeholder="What does this flag control?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm({ key: '', description: '', type: 'boolean' }); }}
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
                  {creating ? 'Creating...' : 'Create Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
