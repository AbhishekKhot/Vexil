import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';

interface Stat { flagKey: string; evaluations: number; enabled: number; disabled: number; passRate: number; }
interface Env { id: string; name: string; }

export default function AnalyticsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const [stats, setStats] = useState<Stat[]>([]);
  const [envs, setEnvs] = useState<Env[]>([]);
  const [selectedEnv, setSelectedEnv] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    api.listEnvironments(projectId).then((e) => {
      const list = e as Env[];
      setEnvs(list);
      if (list.length > 0) setSelectedEnv(list[0].id);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.getStats(projectId, selectedEnv ? { environmentId: selectedEnv } : undefined)
      .then((s) => setStats(s as Stat[]))
      .finally(() => setLoading(false));
  }, [projectId, selectedEnv]);

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Analytics</h2>
        <select value={selectedEnv} onChange={(e) => setSelectedEnv(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All environments</option>
          {envs.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : stats.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">No evaluation data yet</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Flag key</th>
                <th className="px-4 py-3 text-right">Evaluations</th>
                <th className="px-4 py-3 text-right">Enabled</th>
                <th className="px-4 py-3 text-right">Disabled</th>
                <th className="px-4 py-3 text-right">Pass rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {stats.map((s) => (
                <tr key={s.flagKey} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700 dark:text-indigo-400">{s.flagKey}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{s.evaluations.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{s.enabled.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500">{s.disabled.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${s.passRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {s.passRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
