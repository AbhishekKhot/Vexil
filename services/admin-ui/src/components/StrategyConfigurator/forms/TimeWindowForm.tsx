import React from 'react';
import { Clock, Calendar } from 'lucide-react';

interface TimeWindowFormProps {
  startDate: string;
  endDate: string;
  onChange: (updates: { startDate?: string; endDate?: string }) => void;
}

export const TimeWindowForm: React.FC<TimeWindowFormProps> = ({ startDate, endDate, onChange }) => {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          <Calendar className="w-4 h-4 text-primary-500" />
          Active Window (UTC)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Starts At</span>
            <input
              type="datetime-local"
              value={startDate.slice(0, 16)} 
              onChange={(e) => onChange({ startDate: new Date(e.target.value).toISOString() })}
              className="w-full text-xs py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Ends At</span>
            <input
              type="datetime-local"
              value={endDate.slice(0, 16)} 
              onChange={(e) => onChange({ endDate: new Date(e.target.value).toISOString() })}
              className="w-full text-xs py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-4 font-medium leading-relaxed italic">
          Flag will be active only between these dates. All comparisons are done using UTC.
        </p>
      </div>

      <div className="bg-amber-50 p-4 border border-amber-100 rounded-xl flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
          Make sure your client/SDK context includes the correct system time or that the server is NTP synced.
        </p>
      </div>
    </div>
  );
};
