'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Link as LinkIcon, Unlink, RefreshCw } from 'lucide-react';

type DeviceUser = { uid: number; userid: string; name: string; role: number };
type GymMember = { id: string; firstName: string; lastName: string; deviceUserId: string | null };

export default function BiometricsMappingPage() {
  const [mappedUsers, setMappedUsers] = useState<DeviceUser[]>([]);
  const [unmappedUsers, setUnmappedUsers] = useState<DeviceUser[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
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
      }
    } catch (err) {
      console.error(err);
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-indigo-500" />
            Biometric Device Mapping
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Status: {isConnected ? (
              <span className="text-green-600 font-medium">Connected to ZKTeco</span>
            ) : (
              <span className="text-red-600 font-medium">Disconnected</span>
            )}
          </p>
        </div>
        <button onClick={fetchUsers} disabled={loading} className="px-4 py-2 bg-white border shadow-sm rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm font-medium disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Unmapped Users */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="text-lg font-semibold border-b pb-3 mb-3 text-red-600">Unmapped Device Scans</h2>
          {unmappedUsers.length === 0 ? (
            <p className="text-sm text-gray-500">All device users are mapped!</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {unmappedUsers.map(u => (
                <div key={u.userid} className="p-3 border rounded-lg bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{u.name || `User ID: ${u.userid}`}</p>
                    <p className="text-xs text-gray-500">Device PIN: {u.userid}</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select 
                      className="text-sm border rounded p-1.5 w-full sm:w-40 bg-white"
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
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="text-lg font-semibold border-b pb-3 mb-3 text-green-600">Mapped Members</h2>
          {mappedUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No members mapped yet.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {mappedUsers.map(u => {
                const gymMember = members.find(m => m.deviceUserId === u.userid);
                return (
                  <div key={u.userid} className="p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{gymMember?.firstName} {gymMember?.lastName}</p>
                      <p className="text-xs text-gray-500">Linked to Device PIN: {u.userid} ({u.name})</p>
                    </div>
                    <button 
                      onClick={() => handleMap(u.userid, '')}
                      className="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center justify-center gap-1"
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
  );
}
