import React from 'react';
import { Split, Plus, Trash2, Hash } from 'lucide-react';


export interface AbVariant {
  key: string;
  value: any;
  weight: number;
}

interface AbTestFormProps {
  variants: AbVariant[];
  hashAttribute: string;
  onChange: (updates: { variants?: AbVariant[]; hashAttribute?: string }) => void;
}

export const AbTestForm: React.FC<AbTestFormProps> = ({ variants, hashAttribute, onChange }) => {
  const addVariant = () => {
    onChange({ variants: [...variants, { key: '', value: false, weight: 0 }] });
  };

  const removeVariant = (index: number) => {
    onChange({ variants: variants.filter((_, i) => i !== index) });
  };

  const updateVariant = (index: number, updates: Partial<AbVariant>) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange({ variants: newVariants });
  };

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Split className="w-4 h-4 text-primary-500" />
            Variants (Total: {totalWeight}%)
          </label>
          <button
            onClick={addVariant}
            className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors uppercase"
          >
            <Plus className="w-3 h-3" /> Add Variant
          </button>
        </div>

        {variants.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl py-8 flex flex-col items-center justify-center text-slate-400">
            <p className="text-xs font-medium">No variants defined. Add one to split traffic.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {variants.map((v, idx) => (
              <div key={idx} className="flex gap-3 items-start bg-slate-50 p-4 rounded-xl border border-slate-200 group">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Key</span>
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => updateVariant(idx, { key: e.target.value })}
                    placeholder="control, v1..."
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Value (JSON)</span>
                  <input
                    type="text"
                    value={typeof v.value === 'string' ? v.value : JSON.stringify(v.value)}
                    onChange={(e) => {
                       let val = e.target.value;
                       try { val = JSON.parse(e.target.value); } catch { /* keep as string if not valid JSON */ }
                       updateVariant(idx, { value: val });
                    }}
                    placeholder="true, false, 'v1'..."
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono"
                  />
                </div>
                <div className="w-[80px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Weight %</span>
                  <input
                    type="number"
                    value={v.weight}
                    onChange={(e) => updateVariant(idx, { weight: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <button
                  onClick={() => removeVariant(idx)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {totalWeight !== 100 && (
          <p className="text-[11px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100">
            Current total weight is {totalWeight}%. It must sum to 100% exactly.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6 pt-6 border-t border-slate-100">
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
