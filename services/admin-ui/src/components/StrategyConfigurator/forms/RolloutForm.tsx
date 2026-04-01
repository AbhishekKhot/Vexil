import React from 'react';
import { Target, Hash } from 'lucide-react';

interface RolloutFormProps {
  percentage: number;
  hashAttribute: string;
  onChange: (updates: { percentage?: number; hashAttribute?: string }) => void;
}

export const RolloutForm: React.FC<RolloutFormProps> = ({ percentage, hashAttribute, onChange }) => {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <label className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-500" />
            Rollout Percentage
          </span>
          <span className="text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-100">{percentage}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(e) => onChange({ percentage: parseInt(e.target.value) })}
          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary-550"
        />
        <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold uppercase">
          <span>0% (OFF)</span>
          <span>50% (HALFWAY)</span>
          <span>100% (FULL)</span>
        </div>
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
          placeholder="userId, sessionId, deviceId..."
          className="w-full text-sm py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
        />
        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
          The context attribute used to calculate the deterministic hash. Use <strong>userId</strong> for user-consistent rollouts.
        </p>
      </div>
    </div>
  );
};
