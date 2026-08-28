"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LayoutDashboard, Users, CreditCard, Dumbbell, ShieldAlert, FileText, Sun, Moon, LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

// Note: Replace with actual auth mechanism if available via context
// For now, we mock the user or get it from props in layout.

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

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

  const navGroups = [
    {
      label: 'Main',
      items: [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/members', label: 'Members', icon: Users },
      ]
    },
    {
      label: 'Operations',
      items: [
        { href: '/payments', label: 'Payments', icon: CreditCard },
        { href: '/plans', label: 'Plans', icon: Dumbbell },
      ]
    },
    {
      label: 'Administration',
      items: [
        { href: '/audit', label: 'Audit Log', icon: ShieldAlert },
        { href: '/reports', label: 'Reports', icon: FileText },
      ]
    }
  ];

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-40">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-br from-primary to-primary-hover bg-clip-text text-transparent">
          Gym Access
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-8">
        {navGroups.map((group) => (
          <div key={group.label}>
            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.label}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-destructive animate-pulse'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between bg-card border border-border rounded-xl p-2 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar name="Admin User" className="w-8 h-8 text-xs" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold truncate max-w-[100px]">Admin</span>
              <span className="text-xs text-muted-foreground">Staff</span>
            </div>
          </div>
          <button className="p-2 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
