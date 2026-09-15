"use client";

import { Sidebar } from '@/components/layout/Sidebar';
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

import { LiveActivityFeed } from '@/components/ui/LiveActivityFeed';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data, error }) => {
      if (error || !data?.session) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background relative">
      <Sidebar />
      <div className="pl-56 flex flex-col min-h-screen">
        <main className="flex-1 overflow-x-hidden relative">
          {children}
        </main>
      </div>
      <LiveActivityFeed />
    </div>
  );
}
