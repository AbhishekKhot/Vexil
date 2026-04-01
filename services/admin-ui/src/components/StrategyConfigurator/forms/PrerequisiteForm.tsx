import React from 'react';
import { Settings2, HelpCircle } from 'lucide-react';

interface PrerequisiteFormProps {
  flagKey: string;
  expectedValue: any;
  onChange: (updates: { flagKey?: string; expectedValue?: any }) => void;
}

export const PrerequisiteForm: React.FC<PrerequisiteFormProps> = ({ flagKey, expectedValue, onChange }) => {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          <Settings2 className="w-4 h-4 text-primary-500" />
          Prerequisite Flag Key
        </label>
        <input
          type="text"
          value={flagKey}
          onChange={(e) => onChange({ flagKey: e.target.value })}
          placeholder="e.g. auth-v2-enabled"
          className="w-full text-sm py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
        />
        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed italic">
          Flag of which this strategy depends on. Must exist in the same project.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          <HelpCircle className="w-4 h-4 text-primary-500" />
          Expected Value
        </label>
        <input
          type="text"
          value={typeof expectedValue === 'string' ? expectedValue : JSON.stringify(expectedValue)}
          onChange={(e) => {
            let val = e.target.value;
            try { val = JSON.parse(e.target.value); } catch { /* Fallback to string */ }
            onChange({ expectedValue: val });
          }}
          placeholder="true, false, 'v1'..."
          className="w-full text-sm py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
        />
        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed italic">
          Flag will evaluate to true only if the prerequisite evaluates to exactly this value.
        </p>
      </div>
    </div>
  );
};
