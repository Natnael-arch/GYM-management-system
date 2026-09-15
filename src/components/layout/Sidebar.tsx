"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LayoutDashboard, Users, CreditCard, Dumbbell, ShieldAlert, FileText, Sun, Moon, LogOut, CalendarCheck, Fingerprint } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  const isOwner = (session?.user as any)?.role === 'OWNER';

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/members', label: 'Members', icon: Users },
    { href: '/attendance/today', label: 'Attendance', icon: CalendarCheck },
    { href: '/payments', label: 'Payments', icon: CreditCard },
    { href: '/reports', label: 'Reports', icon: FileText },
    ...(isOwner ? [{ href: '/plans', label: 'Plans', icon: Dumbbell }] : []),
    ...(isOwner ? [{ href: '/biometrics', label: 'Biometrics', icon: Fingerprint }] : []),
    ...(isOwner ? [{ href: '/audit', label: 'Audit Log', icon: ShieldAlert }] : []),
  ];

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-card border-r border-border flex flex-col z-40">
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-base font-bold bg-gradient-to-br from-primary to-primary-hover bg-clip-text text-transparent">
          Gym Access
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-success' : 'bg-destructive animate-pulse'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-2 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={session?.user?.name || "User"} className="w-6 h-6 text-[10px] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold truncate">{session?.user?.name || "Loading..."}</span>
              <span className="text-[10px] text-muted-foreground">{(session?.user as any)?.role || "Staff"}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
