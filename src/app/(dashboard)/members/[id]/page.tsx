"use client";

import { useState, useEffect, use } from "react";
import { format } from "date-fns";
import Link from "next/link";

export default function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [member, setMember] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMember = async () => {
      const res = await fetch(`/api/members/${id}`);
      if (res.ok) {
        setMember(await res.json());
      }
    };
    fetchMember();
  }, [id]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const res = await fetch(`/api/members/${id}/attendance?page=${meta.page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data);
        setMeta(data.meta);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [id, meta.page]);

  if (!member) return <div className="p-8">Loading profile...</div>;

  const activeMembership = member.memberships?.find((m: any) => m.status === 'ACTIVE' && new Date(m.endsAt) >= new Date());

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center space-x-6">
          {member.photoUrl ? (
            <img src={member.photoUrl} alt="Photo" className="w-24 h-24 rounded-full object-cover shadow" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold">
              {member.firstName[0]}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{member.firstName} {member.lastName}</h1>
            <p className="text-gray-500 font-mono mt-1">{member.barcode}</p>
            <div className="mt-2 flex space-x-2">
              {member.isBlocked && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold uppercase">Blocked</span>}
              {activeMembership ? (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold uppercase">Active until {format(new Date(activeMembership.endsAt), "MMM d, yyyy")}</span>
              ) : (
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold uppercase">No Active Membership</span>
              )}
            </div>
          </div>
        </div>
        <div className="space-x-3">
          <Link href={`/members/${id}/edit`} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Edit Member
          </Link>
          <Link href={`/cards/${id}`} target="_blank" className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
            Print Card
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Attendance History</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">Loading history...</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">No attendance records found.</td></tr>
            ) : (
              history.map((record: any) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(record.checkInDate), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(record.checkInAt), "h:mm a")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      record.method === 'BARCODE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.method}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {meta.totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <button
              disabled={meta.page === 1}
              onClick={() => setMeta({ ...meta, page: meta.page - 1 })}
              className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</span>
            <button
              disabled={meta.page === meta.totalPages}
              onClick={() => setMeta({ ...meta, page: meta.page + 1 })}
              className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <MembershipManager member={member} refreshMember={() => {
        fetch(`/api/members/${id}`).then(res => res.json()).then(setMember)
      }} />
    </div>
  );
}

function MembershipManager({ member, refreshMember }: { member: any, refreshMember: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  useEffect(() => {
    fetch("/api/plans").then(r => r.json()).then(setPlans);
  }, []);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/members/${member.id}/memberships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: selectedPlanId,
        paymentAmountCents: paymentAmount ? Math.round(parseFloat(paymentAmount) * 100) : undefined,
        paymentMethod: paymentAmount ? paymentMethod : undefined
      })
    });
    if (res.ok) {
      setSelectedPlanId("");
      setPaymentAmount("");
      refreshMember();
    } else {
      alert("Failed to issue membership");
    }
  };

  const toggleFreeze = async (membershipId: string, currentlyFrozen: boolean) => {
    if (!confirm(currentlyFrozen ? "Unfreeze?" : "Freeze?")) return;
    const res = await fetch(`/api/members/${member.id}/memberships/${membershipId}/freeze`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeze: !currentlyFrozen })
    });
    if (res.ok) refreshMember();
  };

  const handleStandalonePayment = async (membershipId: string) => {
    const amt = prompt("Amount paid (ETB):");
    if (!amt) return;
    const method = prompt("Method (CASH/CARD/BANK):", "CASH");
    if (!method) return;
    
    const res = await fetch(`/api/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        membershipId,
        amountCents: Math.round(parseFloat(amt) * 100),
        method
      })
    });
    if (res.ok) refreshMember();
  };

  return (
    <div className="mt-8 bg-white rounded-xl shadow overflow-hidden border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Memberships & Payments</h2>
      
      <form onSubmit={handleIssue} className="flex gap-4 items-end mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Issue / Renew Plan</label>
          <select required value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="w-full px-3 py-2 border rounded-md">
            <option value="">Select a Plan...</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} - {p.durationDays} Days</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Received (ETB)</label>
          <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Optional" className="w-32 px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-24 px-3 py-2 border rounded-md">
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
            <option value="CARD">CARD</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium h-[42px]">
          Issue Plan
        </button>
      </form>

      <div className="space-y-4">
        {member.memberships?.map((m: any) => (
          <div key={m.id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h3 className="font-bold text-lg">{m.plan.name} <span className={`text-xs ml-2 px-2 py-1 rounded ${
                m.status === 'FROZEN' ? 'bg-blue-100 text-blue-800' :
                new Date(m.endsAt) < new Date() ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
              }`}>{m.status}</span></h3>
              <p className="text-sm text-gray-500">{format(new Date(m.startsAt), "MMM d, yyyy")} - {format(new Date(m.endsAt), "MMM d, yyyy")}</p>
              
              <div className="mt-2 text-sm text-gray-600">
                Payments: {m.payments.length === 0 ? "None" : m.payments.map((p: any) => (
                  <span key={p.id} className="mr-2 border px-1 rounded bg-gray-50">{(p.amountCents / 100).toFixed(2)} ETB ({p.method})</span>
                ))}
              </div>
            </div>
            
            <div className="mt-4 md:mt-0 flex gap-2">
              <button onClick={() => toggleFreeze(m.id, m.status === 'FROZEN')} className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50">
                {m.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
              </button>
              <button onClick={() => handleStandalonePayment(m.id)} className="text-sm border border-blue-300 text-blue-700 px-3 py-1 rounded hover:bg-blue-50">
                Record Payment
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
