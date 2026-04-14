import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';

interface Env { id: string; name: string; apiKey: string; createdAt: string; }

export default function EnvironmentsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const [envs, setEnvs] = useState<Env[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    api.listEnvironments(projectId)
      .then((e) => setEnvs(e as Env[]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createEnvironment(projectId!, name);
      setName(''); setShowForm(false); load();
    } catch (err: any) { setError(err.message); }
  };

  const rotate = async (envId: string) => {
    if (!confirm('Rotate API key? The old key will stop working immediately.')) return;
    await api.rotateApiKey(projectId!, envId).catch(() => { });
    load();
  };

  const del = async (envId: string) => {
    if (!confirm('Delete environment? This cannot be undone.')) return;
    await api.deleteEnvironment(projectId!, envId).catch(() => { });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Environments</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700">
          + New environment
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5 space-y-3 shadow-sm">
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          <input placeholder="Environment name (e.g. production)" value={name}
            onChange={(e) => setName(e.target.value)} required
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <div className="flex gap-3">
            <button type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 dark:text-gray-400 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-3">
          {envs.map((env) => (
            <div key={env.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{env.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Created {new Date(env.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => rotate(env.id)}
                    className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 border border-yellow-300 dark:border-yellow-700 px-2 py-1 rounded">
                    Rotate key
                  </button>
                  <button onClick={() => del(env.id)}
                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-700 px-2 py-1 rounded">
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">API Key</label>
                <div className="flex items-center gap-2 font-mono text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-3 py-2">
                  <span className="flex-1 truncate text-gray-800 dark:text-gray-200">
                    {visible[env.id] ? env.apiKey : '•'.repeat(40)}
                  </span>
                  <button onClick={() => setVisible((v) => ({ ...v, [env.id]: !v[env.id] }))}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0">
                    {visible[env.id] ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(env.apiKey)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0">
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
