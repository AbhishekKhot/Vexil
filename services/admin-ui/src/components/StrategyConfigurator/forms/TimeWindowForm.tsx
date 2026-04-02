import React, { useEffect, useState } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { cn } from '../../../utils/cn';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 
  'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'
];

interface TimeWindowFormProps {
  startDate: string;
  endDate: string;
  timezone?: string;
  onChange: (updates: { startDate?: string; endDate?: string; timezone?: string }) => void;
}

export const TimeWindowForm: React.FC<TimeWindowFormProps> = ({ 
  startDate, endDate, timezone = 'UTC', onChange 
}) => {
  const [countdown, setCountdown] = useState<string>('');
  
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const targetTz = timezone || 'UTC';
        const nowObj = new Date(new Date().toLocaleString('en-US', { timeZone: targetTz }));
        const startObj = new Date(startDate);
        const endObj = new Date(endDate);
        
        if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
          setCountdown('Invalid dates');
          return;
        }

        if (nowObj >= startObj && nowObj <= endObj) {
          setCountdown('Active Now');
        } else if (nowObj < startObj) {
          const diffMs = startObj.getTime() - nowObj.getTime();
          const hrs = Math.floor(diffMs / (1000 * 60 * 60));
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          setCountdown(`Starts in ${hrs}h ${mins}m`);
        } else {
          setCountdown('Expired');
        }
      } catch (e) {
        setCountdown('Invalid timezone');
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [startDate, endDate, timezone]);

  const isError = new Date(startDate) >= new Date(endDate);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-primary-500" />
            Active Window
          </label>
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-bold",
            countdown === 'Active Now' ? "bg-green-100 text-green-700" :
            countdown === 'Expired' ? "bg-slate-100 text-slate-500" :
            countdown === 'Invalid dates' ? "bg-red-100 text-red-700" :
            "bg-blue-100 text-blue-700"
          )}>
            {countdown}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Starts At</span>
            <input
              type="datetime-local"
              value={startDate.slice(0, 16)} 
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full text-xs py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Ends At</span>
            <input
              type="datetime-local"
              value={endDate.slice(0, 16)} 
              onChange={(e) => onChange({ endDate: e.target.value })}
              className={cn(
                "w-full text-xs py-2.5 px-4 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 font-medium",
                isError ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-primary-500"
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Timezone</span>
            <select
              value={timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="w-full text-xs py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        
        {isError && (
          <p className="text-red-500 text-xs mt-2 font-bold">Start date must be before end date.</p>
        )}
        
        <p className="text-[11px] text-slate-500 mt-4 font-medium leading-relaxed italic">
          Flag will be active only between these dates in the selected timezone.
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
