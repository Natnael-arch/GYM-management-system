'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Link as LinkIcon, Unlink, RefreshCw } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

type DeviceUser = { uid: number; userid: string; name: string; role: number };
type GymMember = { id: string; firstName: string; lastName: string; deviceUserId: string | null };

export default function BiometricsMappingPage() {
  const [mappedUsers, setMappedUsers] = useState<DeviceUser[]>([]);
  const [unmappedUsers, setUnmappedUsers] = useState<DeviceUser[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [unmappedScansToday, setUnmappedScansToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/biometrics/users');
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.connected);
        setMappedUsers(data.deviceUsers.mapped);
        setUnmappedUsers(data.deviceUsers.unmapped);
        setMembers(data.members);
        setUnmappedScansToday(data.unmappedScansToday || 0);
        setDeviceError(data.error || null);
      } else {
        setDeviceError(data.error || 'Device unreachable');
      }
    } catch (err) {
      console.error(err);
      setDeviceError('Failed to reach device API');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleMap = async (deviceUserId: string, memberId: string) => {
    try {
      await fetch('/api/biometrics/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceUserId, memberId: memberId || null })
      });
      fetchUsers(); // Refresh after map
    } catch (err) {
      console.error('Failed to map', err);
    }
  };

  const statusBadge = isConnected ? (
    <span className="text-success font-medium">Connected to ZKTeco</span>
  ) : (
    <span className="text-destructive font-medium">Disconnected</span>
  );

  return (
    <>
      <TopBar
        title="Biometric Device Mapping"
        subtitle={<>Status: {statusBadge}</>}
        action={
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="px-4 py-2 bg-card border border-border shadow-sm rounded-md hover:bg-muted flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {deviceError && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-900 dark:text-amber-300 text-sm">
            <strong>Device offline:</strong> {deviceError}
            <span className="block mt-1 text-amber-800 dark:text-amber-400">
              Check same-LAN reachability on TCP 4370, firewall, and that no other process holds the device. Run{' '}
              <code className="bg-amber-500/20 px-1 rounded">npm run zk:diag</code> on the server.
            </span>
          </div>
        )}

        {unmappedScansToday > 0 && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-3">
            <Fingerprint className="w-5 h-5 shrink-0" />
            <p>
              <strong>Attention:</strong> There have been <strong>{unmappedScansToday}</strong> fingerprint scan(s) today from a device user that is not mapped to a gym member.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Unmapped Users */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-4">
            <h2 className="text-lg font-semibold border-b border-border pb-3 mb-3 text-destructive">
              Unmapped Device Scans
            </h2>
            {unmappedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">All device users are mapped!</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {unmappedUsers.map(u => (
                  <div key={u.userid} className="p-3 border border-border rounded-lg bg-destructive/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{u.name || `User ID: ${u.userid}`}</p>
                      <p className="text-xs text-muted-foreground">Device PIN: {u.userid}</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        className="text-sm border border-border rounded p-1.5 w-full sm:w-40 bg-background text-foreground"
                        onChange={(e) => {
                          if(e.target.value) handleMap(u.userid, e.target.value);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Select Member...</option>
                        {members.filter(m => !m.deviceUserId).map(m => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mapped Users */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-4">
            <h2 className="text-lg font-semibold border-b border-border pb-3 mb-3 text-success">
              Mapped Members
            </h2>
            {mappedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members mapped yet.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {mappedUsers.map(u => {
                  const gymMember = members.find(m => m.deviceUserId === u.userid);
                  return (
                    <div key={u.userid} className="p-3 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40">
                      <div>
                        <p className="font-medium text-foreground">{gymMember?.firstName} {gymMember?.lastName}</p>
                        <p className="text-xs text-muted-foreground">Linked to Device PIN: {u.userid} ({u.name})</p>
                      </div>
                      <button
                        onClick={() => handleMap(u.userid, '')}
                        className="text-sm px-3 py-1.5 border border-destructive/40 text-destructive rounded hover:bg-destructive/10 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Unlink className="w-3 h-3" /> Unlink
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
