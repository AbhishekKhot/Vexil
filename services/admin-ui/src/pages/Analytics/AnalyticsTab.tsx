import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Loader2, AlertCircle, RefreshCw, Activity, Target, Zap, Search, X } from 'lucide-react';
import { apiClient } from '../../api/client';

interface Stat {
  flagKey: string;
  count: string | number;
  enabledCount: string | number;
}

interface Environment {
  id: string;
  name: string;
}

interface OutletContext {
  projectId: string;
}

export const AnalyticsTab = () => {
  const { projectId } = useOutletContext<OutletContext>();
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [envFilter, setEnvFilter] = useState('');
  const [flagSearch, setFlagSearch] = useState('');

  useEffect(() => {
    apiClient.get(`/projects/${projectId}/environments`).then((r) => setEnvironments(r.data)).catch(() => {});
  }, [projectId]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (envFilter) params.environmentId = envFilter;
      const res = await apiClient.get(`/projects/${projectId}/stats`, { params });
      setStats(res.data);
      setError('');
    } catch {
      setError('Failed to load analytics. Ensure evaluation events are being logged.');
    } finally {
      setLoading(false);
    }
  }, [projectId, envFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const filtered = stats.filter(
    (s) => !flagSearch || s.flagKey.includes(flagSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Evaluation Analytics</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time statistics of feature flag evaluations.</p>
        </div>
        <button
          onClick={fetchStats}
          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all rounded-lg border border-slate-200 bg-white shadow-sm"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">All Environments</option>
          {environments.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by flag key…"
            value={flagSearch}
            onChange={(e) => setFlagSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          />
          {flagSearch && (
            <button onClick={() => setFlagSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 text-amber-700 p-4 rounded-xl mb-6 flex items-center gap-3 border border-amber-100 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-100 py-20">
          <BarChart3 className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-semibold text-slate-600">No Data Yet</p>
          <p className="text-sm max-w-xs text-center mt-2 leading-relaxed">
            {stats.length === 0
              ? 'Evaluation data will appear here once your SDKs start evaluating flags in this project.'
              : 'No flags match your current filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1">
          {filtered.map((stat) => {
            const total = Number(stat.count);
            const enabled = Number(stat.enabledCount);
            const disabled = total - enabled;
            const enabledRate = total > 0 ? Math.round((enabled / total) * 100) : 0;

            return (
              <div key={stat.flagKey} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-mono">{stat.flagKey}</h3>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Evaluation Metrics</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">{total.toLocaleString()}</span>
                    <p className="text-xs text-slate-400 font-bold uppercase">Total Evals</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-slate-500">
                      <Activity className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Enabled</span>
                    </div>
                    <p className="text-lg font-bold text-green-600">{enabled.toLocaleString()}</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-slate-500">
                      <Activity className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Disabled</span>
                    </div>
                    <p className="text-lg font-bold text-red-500">{disabled.toLocaleString()}</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-slate-500">
                      <Target className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Pass Rate</span>
                    </div>
                    <p className="text-lg font-bold text-primary-600">{enabledRate}%</p>
                  </div>

                  <div className="col-span-3 mt-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5 px-0.5">
                      <span>Evaluation Distribution</span>
                      <span>{enabledRate}% Enabled</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 p-0.5">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                        style={{ width: `${enabledRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
