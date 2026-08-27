"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LockdownControls({ initialLockdown }: { initialLockdown: boolean }) {
  const [isLocked, setIsLocked] = useState(initialLockdown);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleLockdown = async () => {
    const newState = !isLocked;
    if (newState && !confirm("Are you sure you want to CLOSE the gym? This will block all incoming check-ins at the kiosk.")) return;
    
    setLoading(true);
    const res = await fetch("/api/settings/lockdown", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockdownMode: newState })
    });
    
    if (res.ok) {
      setIsLocked(newState);
      router.refresh();
    } else {
      alert("Failed to update lockdown status");
    }
    setLoading(false);
  };

  return (
    <div className={`p-4 rounded-xl border-2 flex flex-col items-end ${isLocked ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
      <span className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-700">Door / Kiosk Control</span>
      <button 
        onClick={toggleLockdown}
        disabled={loading}
        className={`px-6 py-3 rounded-lg font-black text-white shadow transition-all ${
          isLocked ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {loading ? "UPDATING..." : isLocked ? "GYM CLOSED (LOCKED DOWN)" : "GYM OPEN (NORMAL)"}
      </button>
      {isLocked && <p className="text-xs text-red-600 font-bold mt-2">All barcode scans will be rejected.</p>}
    </div>
  );
}
