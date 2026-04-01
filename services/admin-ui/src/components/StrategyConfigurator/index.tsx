import React from 'react';
import { 
  Shield, 
  Users, 
  Target, 
  Clock, 
  Layers, 
  UserCheck, 
  Settings2,
  Split
} from 'lucide-react';
import { cn } from '../../utils/cn';

export type StrategyType = 
  | 'boolean'
  | 'rollout'
  | 'targeted_rollout'
  | 'user_targeting'
  | 'attribute_matching'
  | 'ab_test'
  | 'time_window'
  | 'prerequisite';

interface StrategyOption {
  value: StrategyType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const STRATEGIES: StrategyOption[] = [
  { value: 'boolean', label: 'Kill Switch', description: 'Global on/off for all users.', icon: Shield },
  { value: 'rollout', label: 'Gradual Rollout', description: '% of all users via deterministic hash.', icon: Target },
  { value: 'targeted_rollout', label: 'Targeted Rollout', description: '% of users matching specific segments.', icon: Users },
  { value: 'attribute_matching', label: 'Segment Matching', description: 'All users matching specific rules.', icon: Layers },
  { value: 'user_targeting', label: 'User Whitelist', description: 'Explicit IDs for beta/internal testing.', icon: UserCheck },
  { value: 'ab_test', label: 'A/B Test', description: 'Weighted variants for experiment splits.', icon: Split },
  { value: 'time_window', label: 'Schedule Window', description: 'Active only between specific dates.', icon: Clock },
  { value: 'prerequisite', label: 'Prerequisite', description: 'Dependent on another flag\'s value.', icon: Settings2 },
];

interface StrategyConfiguratorProps {
  strategyType: StrategyType;
  onStrategyChange: (newType: StrategyType) => void;
  renderForm: () => React.ReactNode;
}

export const StrategyConfigurator: React.FC<StrategyConfiguratorProps> = ({ 
  strategyType, 
  onStrategyChange,
  renderForm
}) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {STRATEGIES.map((s) => {
          const Icon = s.icon;
          const isActive = strategyType === s.value;
          
          return (
            <button
              key={s.value}
              onClick={() => onStrategyChange(s.value)}
              className={cn(
                "flex flex-col items-start p-4 rounded-xl border text-left transition-all group",
                isActive 
                  ? "bg-primary-50 border-primary-500 shadow-sm" 
                  : "bg-white border-slate-200 hover:border-primary-300 hover:bg-slate-50"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors",
                isActive ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={cn("text-sm font-bold", isActive ? "text-primary-900" : "text-slate-900")}>
                {s.label}
              </span>
              <p className={cn("text-[11px] mt-1 leading-relaxed line-clamp-2", isActive ? "text-primary-700 font-medium" : "text-slate-500")}>
                {s.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[200px] flex flex-col">
        <div className="flex items-center gap-2 mb-6 text-slate-800">
          <Settings2 className="w-4 h-4 text-primary-500" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Strategy Workflow</h3>
        </div>
        {renderForm()}
      </div>
    </div>
  );
};
