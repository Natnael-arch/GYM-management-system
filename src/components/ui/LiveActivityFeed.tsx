"use client";

import { useEffect, useState } from "react";
import { Fingerprint, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Avatar } from "./Avatar";

type ScanEvent = {
  id: string;
  allowed: boolean;
  reason?: string;
  status?: number;
  method: string;
  barcode: string;
  member?: {
    name: string;
    photoUrl?: string | null;
  };
  timestamp: Date;
};

export function LiveActivityFeed() {
  const [events, setEvents] = useState<ScanEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const newEvent: ScanEvent = {
          ...data,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date()
        };
        setEvents(prev => [newEvent, ...prev].slice(0, 5)); // Keep last 5
      } catch (err) {}
    };

    return () => eventSource.close();
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 pointer-events-none">
      {events.map((evt) => (
        <div 
          key={evt.id} 
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border transition-all duration-500 animate-in slide-in-from-right-4 ${
            evt.allowed 
              ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' 
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          {evt.member?.photoUrl ? (
            <img src={evt.member.photoUrl} className="w-10 h-10 rounded-full object-cover shrink-0" alt="Member" />
          ) : (
            <Avatar name={evt.member?.name || "?"} className="w-10 h-10 shrink-0" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate">
                {evt.member?.name || "Unknown Scan"}
              </p>
              {evt.method === 'BIOMETRIC' && <Fingerprint className="w-3.5 h-3.5 opacity-70" />}
            </div>
            
            <p className="text-xs font-medium mt-0.5 opacity-90 flex items-center gap-1.5">
              {evt.allowed ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Access Granted</>
              ) : (
                <><XCircle className="w-3.5 h-3.5" /> {evt.reason?.replace(/_/g, ' ')}</>
              )}
            </p>
          </div>
          
          <button 
            onClick={() => setEvents(prev => prev.filter(e => e.id !== evt.id))}
            className="shrink-0 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
