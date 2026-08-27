"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isBlocked, setIsBlocked] = useState("");
  const [isArchived, setIsArchived] = useState("false");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  
  const { data: session } = authClient.useSession();
  const isOwner = (session?.user as any)?.role === "OWNER";

  const fetchMembers = async () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (isBlocked) params.append("isBlocked", isBlocked);
    if (isArchived) params.append("isArchived", isArchived);

    const res = await fetch(`/api/members?${params.toString()}`);
    if (res.ok) {
      setMembers(await res.json());
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [search, isBlocked, isArchived]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(",");
    router.push(`/cards/print?ids=${ids}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <div className="flex gap-2">
          <button 
            onClick={handleBulkPrint}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
          >
            Print Selected Cards
          </button>
          <Link href="/members/new" className="px-4 py-2 bg-blue-600 text-white rounded">
            Add Member
          </Link>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search name or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <select value={isBlocked} onChange={(e) => setIsBlocked(e.target.value)} className="border p-2 rounded">
          <option value="">All Statuses</option>
          <option value="true">Blocked</option>
          <option value="false">Not Blocked</option>
        </select>
        <select value={isArchived} onChange={(e) => setIsArchived(e.target.value)} className="border p-2 rounded">
          <option value="false">Active Only</option>
          <option value="true">Archived Only</option>
          <option value="">Include Archived</option>
        </select>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-3 w-10">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(members.map(m => m.id)));
                    else setSelectedIds(new Set());
                  }}
                  checked={members.length > 0 && selectedIds.size === members.length}
                />
              </th>
              <th className="p-3">Photo</th>
              <th className="p-3">Name</th>
              <th className="p-3">Barcode</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(member.id)}
                    onChange={() => toggleSelect(member.id)}
                  />
                </td>
                <td className="p-3">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt="Photo" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">No</div>
                  )}
                </td>
                <td className="p-3 font-medium">
                  <Link href={`/members/${member.id}`} className="hover:underline text-blue-700">
                    {member.firstName} {member.lastName}
                  </Link>
                  {member.isArchived && <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">Archived</span>}
                  {member.isBlocked && <span className="ml-2 text-xs bg-red-100 px-2 py-1 rounded text-red-600">Blocked</span>}
                </td>
                <td className="p-3 font-mono text-sm">{member.barcode}</td>
                <td className="p-3">
                  {member.memberships?.length > 0 ? (
                    <span className="text-green-600 text-sm font-medium">Active Membership</span>
                  ) : (
                    <span className="text-gray-500 text-sm">No Active Plan</span>
                  )}
                </td>
                <td className="p-3 space-x-2">
                  <button 
                    onClick={async () => {
                      if (!confirm("Are you sure you want to manually mark this member as present today?")) return;
                      const res = await fetch('/api/check-in/manual', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ memberId: member.id })
                      });
                      const data = await res.json();
                      if (data.allowed) alert("Successfully checked in!");
                      else alert(`Check-in failed: ${data.reason}`);
                    }}
                    className="text-green-600 hover:underline font-medium"
                  >
                    Manual Check-In
                  </button>
                  <Link href={`/members/${member.id}/edit`} className="text-blue-600 hover:underline pl-2 border-l border-gray-300 ml-2">
                    Edit
                  </Link>
                  <a href={`/cards/${member.id}`} target="_blank" className="text-gray-600 hover:underline pl-2 border-l border-gray-300 ml-2">
                    Print Card
                  </a>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">No members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
