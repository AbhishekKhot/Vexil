import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';

interface Segment { id: string; name: string; description?: string; rules: unknown; createdAt: string; }

export default function SegmentsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [rulesJson, setRulesJson] = useState('[]');
  const [error, setError] = useState('');

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    api.listSegments(projectId).then((s) => setSegments(s as Segment[])).finally(() => setLoading(false));
  };

  useEffect(load, [projectId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const rules = JSON.parse(rulesJson);
      await api.createSegment(projectId!, { name, description: desc || undefined, rules });
      setName(''); setDesc(''); setRulesJson('[]'); setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this segment?')) return;
    await api.deleteSegment(projectId!, id).catch(() => { });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Segments</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700">
          + New segment
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5 space-y-3 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">New segment</h3>
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          <input placeholder="Segment name" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Rules (JSON array)</label>
            <textarea value={rulesJson} onChange={(e) => setRulesJson(e.target.value)} rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-xs font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder='[{"attribute":"plan","operator":"eq","value":"pro"}]' />
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
      ) : segments.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">No segments yet</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {segments.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.description ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del(s.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs">Delete</button>
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
