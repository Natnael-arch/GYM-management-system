"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";

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
    <button
      onClick={toggleLockdown}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
        isLocked
          ? 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'
          : 'bg-success/10 text-success border-success/30 hover:bg-success/20'
      }`}
    >
      {isLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
      {loading ? "Updating..." : isLocked ? "Gym Closed" : "Gym Open"}
    </button>
  );
}
