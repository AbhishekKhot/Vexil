import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Users, AlertCircle, Loader2, ChevronDown, ChevronUp, Code2, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../utils/cn';

interface Segment {
  id: string;
  name: string;
  description?: string;
  rules: any;
  createdAt: string;
}

interface OutletContext {
  projectId: string;
}

const DEFAULT_RULES = JSON.stringify(
  [
    {
      attribute: 'country',
      operator: 'in',
      values: ['US', 'CA'],
    },
  ],
  null,
  2
);

export const SegmentsTab = () => {
  const { projectId } = useOutletContext<OutletContext>();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', rules: DEFAULT_RULES });
  const [creating, setCreating] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchSegments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/segments`);
      setSegments(res.data);
    } catch {
      setError('Failed to load segments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, [projectId]);

  const handleRulesChange = (value: string) => {
    setForm((f) => ({ ...f, rules: value }));
    try {
      JSON.parse(value);
      setRulesError('');
    } catch {
      setRulesError('Invalid JSON — please fix before saving.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || rulesError) return;
    let parsedRules: any;
    try {
      parsedRules = JSON.parse(form.rules);
    } catch {
      setRulesError('Invalid JSON — please fix before saving.');
      return;
    }
    try {
      setCreating(true);
      const res = await apiClient.post(`/projects/${projectId}/segments`, {
        name: form.name.trim(),
        description: form.description,
        rules: parsedRules,
      });
      setSegments((prev) => [...prev, res.data]);
      setShowModal(false);
      setForm({ name: '', description: '', rules: DEFAULT_RULES });
      setRulesError('');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create segment.');
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the segment "${name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/segments/${id}`);
      setSegments((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete segment.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Segments</h2>
          <p className="text-sm text-slate-500 mt-0.5">Define user segments using attribute-based targeting rules.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Segment
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
      ) : segments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-100 py-16">
          <Users className="w-14 h-14 mb-4 opacity-40" />
          <p className="text-lg font-semibold">No Segments Defined</p>
          <p className="text-sm mt-1">Create a segment to group users by attribute-based rules.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto">
          {segments.map((seg) => {
            const isExpanded = expandedIds.has(seg.id);
            const ruleCount = Array.isArray(seg.rules) ? seg.rules.length : 0;
            return (
              <div key={seg.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group relative">
                <div className="flex items-center gap-4 p-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{seg.name}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {seg.description && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">{seg.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      Created {new Date(seg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(seg.id, seg.name)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete Segment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleExpand(seg.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      title="View rules"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rules JSON</span>
                    </div>
                    <pre className="text-xs font-mono bg-slate-900 text-green-400 rounded-xl px-4 py-3 overflow-auto max-h-48 leading-relaxed">
                      {JSON.stringify(seg.rules, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Segment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">New Segment</h2>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Segment Name</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. us-users, beta-testers, premium-plan"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 text-sm"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  placeholder="Who does this segment target?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 text-sm"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  Targeting Rules (JSON Array)
                </label>
                <textarea
                  rows={10}
                  value={form.rules}
                  onChange={(e) => handleRulesChange(e.target.value)}
                  className={cn(
                    'w-full font-mono text-xs bg-slate-900 text-green-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 resize-y leading-relaxed',
                    rulesError ? 'ring-2 ring-red-400 focus:ring-red-400' : 'focus:ring-primary-500'
                  )}
                  spellCheck={false}
                />
                {rulesError ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {rulesError}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Provide an array of rule objects with <code className="font-mono">attribute</code>, <code className="font-mono">operator</code>, and <code className="font-mono">values</code> fields.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm({ name: '', description: '', rules: DEFAULT_RULES }); setRulesError(''); }}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !!rulesError}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? 'Creating...' : 'Create Segment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
