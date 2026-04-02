import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, AlertCircle, Clock, FileEdit, Trash2, PlusCircle, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../utils/cn';

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorEmail?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const AuditLogTab = () => {
  const { projectId } = useOutletContext<{ projectId: string }>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/audit-logs`);
      setLogs(res.data.items || []);
    } catch {
      setError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <PlusCircle className="w-4 h-4 text-green-500" />;
      case 'updated': return <FileEdit className="w-4 h-4 text-blue-500" />;
      case 'deleted': return <Trash2 className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-700 border-green-200';
      case 'updated': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'deleted': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-5 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5" /> {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Activity Log</h2>
          <p className="text-sm text-slate-500 mt-1">History of all changes in this project.</p>
        </div>
        <button onClick={fetchLogs} className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-2">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Activity className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-semibold text-lg">No Activity Yet</p>
            <p className="text-sm mt-1">Changes to flags and environments will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col">
                <div 
                  className={cn(
                    "px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer",
                    expandedRow === log.id && "bg-slate-50/80"
                  )}
                  onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">{log.entityType.replace('_', ' ')}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", getActionColor(log.action))}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">
                      {log.metadata?.flagKey ? <span className="font-mono font-medium text-slate-800">[{String(log.metadata.flagKey)}]</span> : null}
                      {log.metadata?.environmentName ? <span className="mx-1">in</span> : null}
                      {log.metadata?.environmentName ? <span className="font-semibold text-slate-700">{String(log.metadata.environmentName)}</span> : null}
                      {log.metadata?.segmentName ? <span className="font-medium text-slate-700">{String(log.metadata.segmentName)}</span> : null}
                      {log.entityType === 'project' && log.metadata?.projectName ? <span className="font-medium text-slate-700">{String(log.metadata.projectName)}</span> : null}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500 flex items-center justify-end gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{log.actorEmail || 'System API'}</p>
                  </div>
                </div>
                
                {expandedRow === log.id && (
                  <div className="bg-slate-50 border-t border-b border-slate-100 p-6 flex flex-col md:flex-row gap-6 mx-4 mb-4 rounded-xl shadow-inner overflow-x-auto text-[11px] font-mono leading-relaxed">
                    <div className="flex-1 overflow-x-auto">
                      <span className="font-bold text-red-500 uppercase tracking-wider block mb-2">- Before</span>
                      <pre className="text-slate-600 bg-white p-4 rounded-lg border border-red-100 shadow-sm">{log.previousValue ? JSON.stringify(log.previousValue, null, 2) : 'null'}</pre>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                      <span className="font-bold text-green-500 uppercase tracking-wider block mb-2">+ After</span>
                      <pre className="text-slate-800 bg-white p-4 rounded-lg border border-green-200 shadow-sm">{log.newValue ? JSON.stringify(log.newValue, null, 2) : 'null'}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
