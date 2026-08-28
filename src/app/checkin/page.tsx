"use client";

import { useState, useEffect, useRef } from "react";
import { format } from 'date-fns-tz';
import { get, set } from 'idb-keyval';

type CheckInResult = {
  allowed: boolean;
  reason?: string;
  member?: {
    name: string;
    photoUrl: string | null;
    membershipEndsAt?: string; // might not have it offline
  };
  checkedInAt?: string;
  scannedAt: Date; // local state
  isOfflineQueued?: boolean; // True if this was an offline queue
};

type OfflineMember = {
  id: string;
  barcode: string;
  name: string;
  photoUrl: string | null;
  isBlocked: boolean;
  isActive: boolean;
};

export default function CheckInKioskPage() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [history, setHistory] = useState<CheckInResult[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [zktecoConnected, setZktecoConnected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync Offline Manifest
  useEffect(() => {
    const syncManifest = async () => {
      try {
        const res = await fetch('/api/members/offline-sync');
        if (res.ok) {
          const members: OfflineMember[] = await res.json();
          await set('members', members);
          console.log(`[Offline Sync] Synced ${members.length} members to IndexedDB`);
        }
      } catch (err) {
        console.warn("[Offline Sync] Failed to sync. Are we offline?");
      }
    };
    
    syncManifest(); // On mount
    const interval = setInterval(syncManifest, 5 * 60 * 1000); // Every 5 mins
    return () => clearInterval(interval);
  }, []);

  // Background Queue Replay
  useEffect(() => {
    const replayQueue = async () => {
      if (!navigator.onLine) return;

      const queue: any[] = await get('offline_queue') || [];
      if (queue.length === 0) {
        setQueueCount(0);
        return;
      }

      setQueueCount(queue.length);
      
      const remainingQueue = [];
      for (const item of queue) {
        try {
          const res = await fetch("/api/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barcode: item.barcode }) // replay just the barcode
          });
          
          if (res.ok || res.status === 409) {
            // 409 means ALREADY_CHECKED_IN, which means it synced but maybe we retried, or they scanned online too.
            // Safe to remove from queue.
            console.log(`[Replay] Successfully replayed barcode ${item.barcode}`);
          } else {
            // Failed validation online (e.g. they got blocked while offline). Still remove it because it's a hard reject.
            console.warn(`[Replay] Hard reject for ${item.barcode} during replay. Status: ${res.status}`);
          }
        } catch (error) {
          // Network error during replay -> keep in queue
          remainingQueue.push(item);
        }
      }

      await set('offline_queue', remainingQueue);
      setQueueCount(remainingQueue.length);
    };

    const interval = setInterval(replayQueue, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  // ZKTeco Status Polling
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/biometrics/status');
        if (res.ok) {
          const data = await res.json();
          setZktecoConnected(data.connected);
        }
      } catch (err) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Global keydown listener to capture all scans regardless of focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body && e.target !== inputRef.current) return;
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerDoorRelay = async () => {
    try {
      await fetch('/api/access/relay', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: 'unlock' })
      });
    } catch (e) {
      console.warn("Failed to trigger door relay", e);
    }
  };

  const processOfflineFallback = async (code: string) => {
    console.warn(`[Offline] Processing barcode ${code} via IDB...`);
    const members: OfflineMember[] = await get('members') || [];
    const member = members.find(m => m.barcode === code);

    const currentResult: CheckInResult = { scannedAt: new Date(), allowed: false };

    if (!member) {
      currentResult.reason = 'UNKNOWN_ID';
    } else if (member.isBlocked) {
      currentResult.reason = 'BLOCKED';
    } else if (!member.isActive) {
      currentResult.reason = 'MEMBERSHIP_EXPIRED';
    } else {
      currentResult.allowed = true;
      currentResult.isOfflineQueued = true;
      currentResult.member = {
        name: member.name,
        photoUrl: member.photoUrl,
        membershipEndsAt: "Valid (Offline)" // We don't cache the exact date currently, just boolean
      };

      // Add to queue
      const queue: any[] = await get('offline_queue') || [];
      queue.push({ barcode: code, scannedAt: new Date().toISOString() });
      await set('offline_queue', queue);
      setQueueCount(queue.length);
    }

    setResult(currentResult);
    setHistory(prev => [currentResult, ...prev].slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeToScan = barcode.trim();
    if (!codeToScan) return;
    setBarcode("");
    
    try {
      // If we know we're offline, don't even bother fetching
      if (!navigator.onLine) {
        throw new TypeError("Failed to fetch");
      }

      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: codeToScan })
      });
      
      const data = await res.json();
      const currentResult = { ...data, scannedAt: new Date() };
      
      setResult(currentResult);
      setHistory(prev => [currentResult, ...prev].slice(0, 10));
      
      // Hardware integration
      if (currentResult.allowed) {
        triggerDoorRelay();
      }

    } catch (err: any) {
      // Network failures usually throw TypeError
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
        await processOfflineFallback(codeToScan);
      } else {
        console.error(err);
        setResult({ allowed: false, reason: "SYSTEM_ERROR", scannedAt: new Date() });
      }
    }
  };

  const getReasonText = (reason?: string) => {
    switch (reason) {
      case "UNKNOWN_ID": return "Unknown ID Card / ያልታወቀ መታወቂያ";
      case "BLOCKED": return "Member Blocked / አባል ታግዷል";
      case "MEMBERSHIP_EXPIRED": return "Membership Expired / የአባልነት ጊዜ አልቋል";
      case "ALREADY_CHECKED_IN": return "Already Checked In Today / ዛሬ አስቀድሞ ገብቷል";
      case "GYM_CLOSED": return "Gym Closed (Lockdown) / ጂም ዝግ ነው";
      default: return reason || "Access Denied / መግባት ተከልክሏል";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-8 relative">
      <div className="absolute top-4 right-4 flex items-center gap-4 z-40 bg-card px-4 py-2 rounded-full border border-border shadow-sm">
        {queueCount > 0 && (
          <div className="text-warning font-medium text-sm flex items-center gap-2 border-r border-border pr-4">
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
            Offline Queue: {queueCount}
          </div>
        )}
        <div className={`font-medium text-sm flex items-center gap-2 ${zktecoConnected ? 'text-success' : 'text-muted-foreground'}`}>
          <span className={`w-2 h-2 rounded-full ${zktecoConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}></span>
          ZKTeco {zktecoConnected ? 'Connected' : 'Offline'}
        </div>
      </div>

      {queueCount > 0 && (
        <div className="absolute top-0 left-0 w-full bg-warning text-warning-foreground text-center py-2 font-bold z-50 animate-pulse shadow-lg">
          OFFLINE MODE ACTIVE - Checks are local, scans will sync later
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <form onSubmit={handleSubmit} className="absolute top-0 left-0 opacity-0 pointer-events-none">
          <input 
            ref={inputRef}
            type="text" 
            value={barcode} 
            onChange={(e) => setBarcode(e.target.value)}
            autoFocus 
          />
        </form>

        {!result ? (
          <div className="text-center text-muted-foreground mt-16">
            <svg className="w-24 h-24 mx-auto mb-4 animate-pulse opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <h1 className="text-4xl font-bold tracking-widest uppercase">Ready to Scan</h1>
          </div>
        ) : (
          <div className={`w-full max-w-4xl p-12 rounded-3xl text-center shadow-2xl transition-all mt-16 ${
            result.allowed ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'
          }`}>
            {result.allowed && result.member ? (
              <div className="flex items-center justify-center space-x-12 relative">
                {result.isOfflineQueued && (
                  <div className="absolute -top-8 bg-warning text-warning-foreground font-bold px-4 py-1 rounded-full uppercase text-xs tracking-wider shadow">
                    Queued Offline
                  </div>
                )}
                {result.member.photoUrl ? (
                  <img src={result.member.photoUrl} alt="Photo" className="w-64 h-64 rounded-full object-cover shadow-xl border-8 border-success-foreground/20" />
                ) : (
                  <div className="w-64 h-64 rounded-full bg-success-foreground/20 flex items-center justify-center text-success-foreground text-3xl font-bold border-8 border-success-foreground/40">
                    No Photo
                  </div>
                )}
                <div className="text-left">
                  <h1 className="text-7xl font-bold mb-4 drop-shadow-md">{result.member.name}</h1>
                  <h2 className="text-4xl font-semibold opacity-90">Access Granted</h2>
                  <p className="text-xl mt-4 opacity-80">Membership active until {result.member.membershipEndsAt?.includes('Valid') ? result.member.membershipEndsAt : format(new Date(result.member.membershipEndsAt!), 'MMM d, yyyy')}</p>
                </div>
              </div>
            ) : (
              <div className="py-16 relative">
                {result.reason === 'GYM_CLOSED' && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-warning text-warning-foreground font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow">
                    LOCKDOWN ACTIVE
                  </div>
                )}
                <svg className="w-32 h-32 mx-auto mb-6 opacity-80 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h1 className="text-6xl font-bold mb-6 drop-shadow-md">ACCESS DENIED</h1>
                <h2 className="text-4xl font-bold opacity-90 uppercase px-8">{getReasonText(result.reason)}</h2>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-8">
        <h3 className="text-muted-foreground uppercase tracking-wider text-sm font-bold mb-4">Recent Scans</h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {history.length === 0 && <span className="text-muted-foreground">No recent scans.</span>}
          {history.map((h, i) => (
            <div key={i} className={`flex-shrink-0 w-64 p-4 rounded-xl border ${h.allowed ? 'border-success bg-success/10 text-success' : 'border-destructive bg-destructive/10 text-destructive'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded ${h.allowed ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                  {h.allowed ? (h.isOfflineQueued ? 'QUEUED' : 'ALLOW') : 'DENY'}
                </span>
                <span className="text-xs opacity-70">{format(h.scannedAt, 'HH:mm:ss')}</span>
              </div>
              <p className="font-semibold truncate">{h.allowed ? h.member?.name : h.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
