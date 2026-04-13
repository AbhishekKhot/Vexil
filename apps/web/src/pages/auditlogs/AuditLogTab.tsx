import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  metadata: unknown;
  createdAt: string;
}

interface AuditResponse { data: AuditLog[]; total: number; page: number; limit: number; }

export default function AuditLogTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = (p: number) => {
    if (!projectId) return;
    setLoading(true);
    api.getAuditLogs(projectId, { page: String(p), limit: String(limit) })
      .then((r) => {
        const res = r as AuditResponse;
        setLogs(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(page), [projectId, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-5">Audit Logs</h2>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">No audit logs yet</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Entity ID</th>
                  <th className="px-4 py-3 text-left">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3">
                      <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{log.entityType}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs truncate max-w-[200px]">
                      {log.entityId}
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
