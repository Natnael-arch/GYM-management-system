"use client";

import { Sidebar } from '@/components/layout/Sidebar';
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

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
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      Loading...
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
