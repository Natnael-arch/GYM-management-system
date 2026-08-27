"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await authClient.getSession();
      if (!data?.session) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r">
        <div className="p-4 border-b font-bold text-lg">Gym Access</div>
        <nav className="p-4 space-y-2">
          <Link href="/" className="block p-2 hover:bg-gray-50 rounded">Today</Link>
          <Link href="/members" className="block p-2 hover:bg-gray-50 rounded">Members</Link>
          <Link href="/memberships" className="block p-2 hover:bg-gray-50 rounded">Memberships</Link>
          <Link href="/attendance" className="block p-2 hover:bg-gray-50 rounded">Attendance</Link>
          <Link href="/reports" className="block px-3 py-2 rounded-md hover:bg-gray-100 font-medium">Reports</Link>
          <Link href="/audit" className="block px-3 py-2 rounded-md hover:bg-gray-100 font-medium text-purple-700">Audit Logs</Link>
          <button 
            className="block w-full text-left p-2 hover:bg-gray-50 rounded text-red-600 mt-8"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
          >
            Log Out
          </button>
        </nav>
      </div>
      <div className="flex-1 overflow-auto p-8">
        {children}
      </div>
    </div>
  );
}
