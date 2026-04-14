import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

interface Flag { id: string; key: string; name: string; description?: string; type: string; createdAt: string; }

export default function FlagsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('boolean');
  const [error, setError] = useState('');

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    api.listFlags(projectId)
      .then((f) => setFlags(f as Flag[]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createFlag(projectId!, { key, name, description: desc || undefined, type });
      setKey(''); setName(''); setDesc(''); setType('boolean'); setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this flag?')) return;
    await api.deleteFlag(projectId!, id).catch(() => { });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Feature Flags</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700">
          + New flag
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5 space-y-3 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">New flag</h3>
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Key (lowercase-dashes)</label>
              <input placeholder="my-feature" value={key} onChange={(e) => setKey(e.target.value)} required
                pattern="[a-z0-9-]+"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Display name</label>
              <input placeholder="My Feature" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          <input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Value type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option value="boolean">Boolean</option>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="json">JSON</option>
            </select>
          </div>
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
      ) : flags.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p>No flags yet — create one to get started</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Key</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {flags.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700 dark:text-indigo-400">{f.key}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{f.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{f.type}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/projects/${projectId}/flags/${f.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline mr-4 text-xs">Configure</Link>
                    <button onClick={() => remove(f.id)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs">Delete</button>
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
