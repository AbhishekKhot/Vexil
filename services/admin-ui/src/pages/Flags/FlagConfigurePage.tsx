import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  ToggleLeft, 
  ToggleRight, 
  ChevronDown, 
  ChevronUp, 
  Save 
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../utils/cn';
import { StrategyConfigurator } from '../../components/StrategyConfigurator';
import type { StrategyType } from '../../components/StrategyConfigurator';
import { RolloutForm } from '../../components/StrategyConfigurator/forms/RolloutForm';
import { TargetedRolloutForm } from '../../components/StrategyConfigurator/forms/TargetedRolloutForm';
import { UserTargetingForm } from '../../components/StrategyConfigurator/forms/UserTargetingForm';
import { AbTestForm } from '../../components/StrategyConfigurator/forms/AbTestForm';
import { TimeWindowForm } from '../../components/StrategyConfigurator/forms/TimeWindowForm';
import { PrerequisiteForm } from '../../components/StrategyConfigurator/forms/PrerequisiteForm';

interface Flag {
  id: string;
  key: string;
  description?: string;
  type: string;
}

interface Environment {
  id: string;
  name: string;
  apiKey: string;
}

interface FlagConfig {
  id?: string;
  isEnabled: boolean;
  strategyType: StrategyType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategyConfig: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules?: any; // legacy
  scheduledAt?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduledConfig?: Record<string, any> | null;
}

interface ConfigState {
  isEnabled: boolean;
  strategyType: StrategyType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategyConfig: Record<string, any>;
  scheduledAt: string | null;
  scheduledEnabled: boolean;
  scheduledStrategyType: StrategyType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduledStrategyConfig: Record<string, any>;
  saving: boolean;
  saved: boolean;
  expanded: boolean;
  originalConfig: FlagConfig | null;
}

const ENV_COLOR_MAP: Record<string, { badge: string; dot: string }> = {
  production: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  prod: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  staging: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  stage: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  development: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  dev: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

const getEnvStyle = (name: string) =>
  ENV_COLOR_MAP[name.toLowerCase()] ?? { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };

export const FlagConfigurePage = () => {
  const { projectId, flagId } = useParams<{ projectId: string; flagId: string }>();
  const navigate = useNavigate();

  const [flag, setFlag] = useState<Flag | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [configMap, setConfigMap] = useState<Record<string, ConfigState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!projectId || !flagId) return;
    try {
      setLoading(true);
      const [flagRes, envRes] = await Promise.all([
        apiClient.get(`/projects/${projectId}/flags/${flagId}`),
        apiClient.get(`/projects/${projectId}/environments`),
      ]);
      setFlag(flagRes.data);
      const envs: Environment[] = envRes.data;
      setEnvironments(envs);

      const configEntries = await Promise.all(
        envs.map(async (env) => {
          try {
            const res = await apiClient.get(`/projects/${projectId}/environments/${env.id}/flags/${flagId}`);
            const cfg: FlagConfig = res.data;
            return [
              env.id,
              {
                isEnabled: cfg.isEnabled ?? false,
                strategyType: (cfg.strategyType as StrategyType) || 'boolean',
                strategyConfig: cfg.strategyConfig || {},
                scheduledAt: cfg.scheduledAt || null,
                scheduledEnabled: cfg.scheduledConfig?.isEnabled ?? (cfg.isEnabled ?? false),
                scheduledStrategyType: (cfg.scheduledConfig?.strategyType as StrategyType) || 'boolean',
                scheduledStrategyConfig: cfg.scheduledConfig?.strategyConfig || {},
                saving: false,
                saved: false,
                expanded: false,
                originalConfig: cfg,
              } as ConfigState,
            ];
          } catch {
            return [
              env.id,
              {
                isEnabled: false,
                strategyType: 'boolean',
                strategyConfig: {},
                scheduledAt: null,
                scheduledEnabled: false,
                scheduledStrategyType: 'boolean',
                scheduledStrategyConfig: {},
                saving: false,
                saved: false,
                expanded: false,
                originalConfig: null,
              } as ConfigState,
            ];
          }
        })
      );
      setConfigMap(Object.fromEntries(configEntries));
    } catch {
      setError('Failed to load flag configuration data.');
    } finally {
      setLoading(false);
    }
  }, [projectId, flagId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateConfigField = (envId: string, updates: Partial<ConfigState>) => {
    setConfigMap((prev) => ({
      ...prev,
      [envId]: { ...prev[envId], ...updates },
    }));
  };

  const updateStrategyConfig = (envId: string, updates: Record<string, any>) => {
    setConfigMap((prev) => ({
      ...prev,
      [envId]: {
        ...prev[envId],
        strategyConfig: { ...prev[envId].strategyConfig, ...updates },
        saved: false
      },
    }));
  };

  const updateScheduledStrategyConfig = (envId: string, updates: Record<string, any>) => {
    setConfigMap((prev) => ({
      ...prev,
      [envId]: {
        ...prev[envId],
        scheduledStrategyConfig: { ...prev[envId].scheduledStrategyConfig, ...updates },
        saved: false
      },
    }));
  };

  const handleToggle = (envId: string) => {
    updateConfigField(envId, { isEnabled: !configMap[envId].isEnabled, saved: false });
  };

  const handleSave = async (envId: string) => {
    const cfg = configMap[envId];
    updateConfigField(envId, { saving: true });
    try {
      await apiClient.put(`/projects/${projectId}/environments/${envId}/flags/${flagId}`, {
        isEnabled: cfg.isEnabled,
        strategyType: cfg.strategyType,
        strategyConfig: cfg.strategyConfig,
        scheduledAt: cfg.scheduledAt,
        scheduledConfig: cfg.scheduledAt ? {
           isEnabled: cfg.scheduledEnabled,
           strategyType: cfg.scheduledStrategyType,
           strategyConfig: cfg.scheduledStrategyConfig,
        } : null,
      });
      updateConfigField(envId, { saving: false, saved: true });
      setTimeout(() => updateConfigField(envId, { saved: false }), 2500);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save configuration.');
      updateConfigField(envId, { saving: false });
    }
  };

  const renderStrategyForm = (envId: string, isScheduled: boolean = false) => {
    const cfg = configMap[envId];
    if (!cfg) return null;

    const stratType = isScheduled ? cfg.scheduledStrategyType : cfg.strategyType;
    const stratConfig = isScheduled ? cfg.scheduledStrategyConfig : cfg.strategyConfig;
    const updConfig = isScheduled ? updateScheduledStrategyConfig : updateStrategyConfig;

    switch (stratType) {
      case 'rollout':
        return (
          <RolloutForm 
            percentage={stratConfig.percentage ?? 0}
            hashAttribute={stratConfig.hashAttribute ?? 'userId'}
            onChange={(updates) => updConfig(envId, updates)}
          />
        );
      case 'targeted_rollout':
      case 'attribute_matching':
        return (
          <TargetedRolloutForm
            percentage={stratType === 'attribute_matching' ? 100 : (stratConfig.percentage ?? 0)}
            hashAttribute={stratConfig.hashAttribute ?? 'userId'}
            rules={stratConfig.rules ?? []}
            onChange={(updates) => updConfig(envId, updates)}
          />
        );
      case 'user_targeting':
        return (
          <UserTargetingForm
            userIds={stratConfig.userIds ?? []}
            hashAttribute={stratConfig.hashAttribute ?? 'userId'}
            fallthrough={stratConfig.fallthrough ?? false}
            onChange={(updates) => updConfig(envId, updates)}
          />
        );
      case 'ab_test':
        return (
          <AbTestForm
            variants={stratConfig.variants ?? []}
            hashAttribute={stratConfig.hashAttribute ?? 'userId'}
            onChange={(updates) => updConfig(envId, updates)}
          />
        );
      case 'time_window':
        return (
          <TimeWindowForm
            startDate={stratConfig.startDate ?? new Date().toISOString()}
            endDate={stratConfig.endDate ?? new Date().toISOString()}
            timezone={stratConfig.timezone ?? 'UTC'}
            onChange={(updates) => updConfig(envId, updates)}
          />
        );
      case 'prerequisite':
        return (
          <PrerequisiteForm
            flagKey={stratConfig.flagKey ?? ''}
            expectedValue={stratConfig.expectedValue ?? true}
            onChange={(updates) => updConfig(envId, updates)}
          />
        );
      case 'boolean':
      default: {
        const enabled = isScheduled ? cfg.scheduledEnabled : cfg.isEnabled;
        return (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Standard Kill Switch enabled. Flag will return <strong>{enabled ? 'true' : 'false'}</strong> globally in this environment.
            </p>
          </div>
        );
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto bg-red-50 text-red-600 p-5 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5" /> {error}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-full">
      {/* Back */}
      <button
        onClick={() => navigate(`/projects/${projectId}/flags`)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors w-fit group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Flags
      </button>

      {/* Flag Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900 font-mono">{flag?.key}</h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {flag?.type}
          </span>
        </div>
        {flag?.description && <p className="text-slate-500 mt-1">{flag.description}</p>}
        <div className="flex items-center gap-4 mt-2">
          <p className="text-sm text-slate-400">Configure evaluation strategies per environment.</p>
          <a
            href={`/projects/${projectId}/activity`}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-2 flex items-center gap-1"
          >
            View change history for this flag
          </a>
        </div>
      </div>

      {environments.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white/60 rounded-2xl border border-slate-100 py-16 text-slate-400">
          <ToggleLeft className="w-14 h-14 mb-4 opacity-40" />
          <p className="font-semibold text-lg">No Environments</p>
          <p className="text-sm mt-1">Create environments first to configure strategies.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 overflow-y-auto pb-10">
          {environments.map((env) => {
            const cfg = configMap[env.id];
            if (!cfg) return null;
            const envStyle = getEnvStyle(env.name);

            return (
              <div
                key={env.id}
                className={cn(
                  'bg-white border rounded-3xl transition-all duration-300 overflow-hidden',
                  cfg.expanded ? 'border-primary-200 ring-4 ring-primary-50/50' : 'border-slate-200 hover:border-slate-300 shadow-sm'
                )}
              >
                {/* Card Header */}
                <div className="flex items-center gap-4 p-6">
                  {/* Status dot */}
                  <div className={cn('w-3 h-3 rounded-full flex-shrink-0 transition-all duration-300', cfg.isEnabled ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-300')} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">{env.name}</span>
                      <span className={cn('text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider', envStyle.badge)}>
                        {env.name}
                      </span>
                      {cfg.strategyType === 'time_window' && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider bg-purple-100 text-purple-700">
                          Scheduled
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-1">{env.apiKey}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(env.id)}
                      className="focus:outline-none transition-all mr-2"
                      title={cfg.isEnabled ? 'Disable flag' : 'Enable flag'}
                    >
                      {cfg.isEnabled ? (
                        <ToggleRight className="w-10 h-10 text-primary-600 hover:text-primary-700 transition-colors" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300 hover:text-slate-400 transition-colors" />
                      )}
                    </button>

                    {/* Rules expander */}
                    <button
                      onClick={() => updateConfigField(env.id, { expanded: !cfg.expanded })}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        cfg.expanded ? "bg-slate-100 text-slate-900" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {cfg.expanded ? 'Collapse Config' : 'Configure Strategy'}
                      {cfg.expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {/* Save button */}
                    {cfg.expanded && (() => {
                      const isSaveDisabled = cfg.saving || (
                        cfg.strategyType === 'time_window' && 
                        new Date(cfg.strategyConfig.startDate || '') >= new Date(cfg.strategyConfig.endDate || '')
                      );
                      
                      return (
                      <button
                        onClick={() => handleSave(env.id)}
                        disabled={isSaveDisabled}
                        className={cn(
                          'flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all',
                          cfg.saved
                            ? 'bg-green-500 text-white'
                            : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200 disabled:opacity-60'
                        )}
                      >
                        {cfg.saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {cfg.saved ? 'Saved!' : cfg.saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    )})()}
                  </div>
                </div>

                {/* Strategy Configurator (Expandable) */}
                {cfg.expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 flex flex-col">
                    <div className="p-8">
                      <StrategyConfigurator 
                        strategyType={cfg.strategyType}
                        onStrategyChange={(type) => updateConfigField(env.id, { strategyType: type, saved: false })}
                        renderForm={() => renderStrategyForm(env.id, false)}
                      />
                    </div>
                    
                    <div className="border-t border-slate-200 p-8 bg-purple-50/30">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Schedule a Future Change</h3>
                          <p className="text-[11px] text-slate-500 mt-1">Configure a config to automatically apply at a later date.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {cfg.scheduledAt && (
                            <button
                              onClick={() => updateConfigField(env.id, { scheduledAt: null, saved: false })}
                              className="text-[10px] uppercase font-bold text-red-500 hover:text-red-700 underline"
                            >
                              Clear Schedule
                            </button>
                          )}
                          <input
                            type="datetime-local"
                            value={cfg.scheduledAt ? cfg.scheduledAt.slice(0, 16) : ''}
                            onChange={(e) => updateConfigField(env.id, { scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null, saved: false })}
                            className="text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                          />
                        </div>
                      </div>
                      
                      {cfg.scheduledAt && (
                        <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm mt-4">
                          <div className="flex items-center gap-4 mb-6">
                            <button
                              onClick={() => updateConfigField(env.id, { scheduledEnabled: !cfg.scheduledEnabled, saved: false })}
                              className="focus:outline-none transition-all"
                            >
                              {cfg.scheduledEnabled ? (
                                <ToggleRight className="w-8 h-8 text-purple-600 hover:text-purple-700 transition-colors" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400 transition-colors" />
                              )}
                            </button>
                            <span className="text-xs font-bold text-slate-700">
                              {cfg.scheduledEnabled ? 'Flag will be ENABLED' : 'Flag will be DISABLED'}
                            </span>
                          </div>
                          <StrategyConfigurator 
                            strategyType={cfg.scheduledStrategyType}
                            onStrategyChange={(type) => updateConfigField(env.id, { scheduledStrategyType: type, saved: false })}
                            renderForm={() => renderStrategyForm(env.id, true)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
