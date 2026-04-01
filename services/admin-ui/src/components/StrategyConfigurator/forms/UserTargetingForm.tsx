import React from 'react';
import { UserCheck, Hash, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface UserTargetingFormProps {
  userIds: string[];
  hashAttribute: string;
  fallthrough: boolean;
  onChange: (updates: { userIds?: string[]; hashAttribute?: string; fallthrough?: boolean }) => void;
}

export const UserTargetingForm: React.FC<UserTargetingFormProps> = ({ 
  userIds, 
  hashAttribute, 
  fallthrough, 
  onChange 
}) => {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          <UserCheck className="w-4 h-4 text-primary-500" />
          User Whitelist
        </label>
        <textarea
          rows={5}
          value={userIds.join('\n')}
          onChange={(e) => onChange({ userIds: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) })}
          placeholder="Enter user IDs, one per line..."
          className="w-full font-mono text-xs bg-slate-900 text-green-400 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y leading-relaxed"
          spellCheck={false}
        />
        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
          Users in this list will <strong>always</strong> receive the flag (evaluates to true).
        </p>
      </div>

      <div className="flex flex-col gap-6 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Fallthrough Value
            </label>
            <p className="text-[11px] text-slate-500 font-medium">
              Result for users <strong>NOT</strong> in the whitelist.
            </p>
          </div>
          <button
            onClick={() => onChange({ fallthrough: !fallthrough })}
            className="focus:outline-none transition-all"
          >
            {fallthrough ? (
              <ToggleRight className="w-10 h-10 text-primary-600" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-slate-300" />
            )}
          </button>
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
