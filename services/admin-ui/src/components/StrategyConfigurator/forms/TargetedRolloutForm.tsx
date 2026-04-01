import React from 'react';
import { Target, Hash, Filter, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface TargetingRule {
  attribute: string;
  operator: string;
  values: string[];
}

interface TargetedRolloutFormProps {
  percentage: number;
  hashAttribute: string;
  rules: TargetingRule[];
  onChange: (updates: { percentage?: number; hashAttribute?: string; rules?: TargetingRule[] }) => void;
}

const OPERATORS = [
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not in List' },
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
];

export const TargetedRolloutForm: React.FC<TargetedRolloutFormProps> = ({ 
  percentage, 
  hashAttribute, 
  rules, 
  onChange 
}) => {
  const addRule = () => {
    onChange({ rules: [...rules, { attribute: '', operator: 'in', values: [] }] });
  };

  const removeRule = (index: number) => {
    onChange({ rules: rules.filter((_, i) => i !== index) });
  };

  const updateRule = (index: number, updates: Partial<TargetingRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    onChange({ rules: newRules });
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Rules Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-primary-500" />
            Segment Targeting Rules (AND)
          </label>
          <button
            onClick={addRule}
            className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors uppercase"
          >
            <Plus className="w-3 h-3" />
            Add Rule
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl py-8 flex flex-col items-center justify-center text-slate-400">
            <p className="text-xs font-medium">No targeting rules defined.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rules.map((rule, idx) => (
              <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-start bg-slate-50 p-4 rounded-xl border border-slate-200 group">
                <div className="flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={rule.attribute}
                    onChange={(e) => updateRule(idx, { attribute: e.target.value })}
                    placeholder="Attribute (e.g. country)"
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono"
                  />
                </div>
                <div className="w-[140px]">
                  <select
                    value={rule.operator}
                    onChange={(e) => updateRule(idx, { operator: e.target.value })}
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-medium"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-[2] min-w-[180px]">
                  <input
                    type="text"
                    value={rule.values.join(',')}
                    onChange={(e) => updateRule(idx, { values: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                    placeholder="Values (comma separated)"
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono"
                  />
                </div>
                <button
                  onClick={() => removeRule(idx)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rollout Section */}
      <div className="flex flex-col gap-6 pt-6 border-t border-slate-100">
        <div>
          <label className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
            <span className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary-500" />
              Sub-group Rollout
            </span>
            <span className="text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-100 font-mono">{percentage}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={percentage}
            onChange={(e) => onChange({ percentage: parseInt(e.target.value) })}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary-550"
          />
          <p className="text-[11px] text-slate-500 mt-2 font-medium italic">
            This rollout applies only to users matching the rules above.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            <Hash className="w-4 h-4 text-primary-500" />
            Hash Identifier
          </label>
          <input
            type="text"
            value={hashAttribute}
            onChange={(e) => onChange({ hashAttribute: e.target.value })}
            placeholder="userId"
            className="w-full text-sm py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>
      </div>
    </div>
  );
};
