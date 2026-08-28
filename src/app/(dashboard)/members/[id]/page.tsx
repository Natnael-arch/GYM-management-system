"use client";

import { useState, useEffect, use } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { Printer, Edit } from "lucide-react";

export default function MemberDetailPanel({ params }: { params: Promise<{ id: string }> }) {
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

  if (!member) return <div className="p-8 text-center text-muted-foreground flex-1 flex items-center justify-center">Loading profile...</div>;

  const activeMembership = member.memberships?.find((m: any) => m.status === 'ACTIVE' && new Date(m.endsAt) >= new Date());

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div className="flex items-center gap-6">
            {member.photoUrl ? (
              <img src={member.photoUrl} alt="Photo" className="w-24 h-24 rounded-full object-cover shadow-sm ring-4 ring-background" />
            ) : (
              <Avatar name={`${member.firstName} ${member.lastName}`} className="w-24 h-24 text-3xl shadow-sm ring-4 ring-background" />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{member.firstName} {member.lastName}</h1>
              <p className="text-muted-foreground font-mono mt-1 text-sm">{member.barcode}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {member.isBlocked && <Badge variant="danger">Blocked</Badge>}
                {activeMembership ? (
                  <Badge variant="success">Active until {format(new Date(activeMembership.endsAt), "MMM d, yyyy")}</Badge>
                ) : (
                  <Badge variant="neutral">No Active Membership</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Link 
              href={`/members/${id}/edit`} 
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 border border-input bg-background hover:bg-muted text-sm font-medium rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
            <Link 
              href={`/cards/${id}`} 
              target="_blank" 
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover text-sm font-medium rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Card
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Attendance History</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Loading history...</TableCell></TableRow>
              ) : history.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No attendance records found.</TableCell></TableRow>
              ) : (
                history.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.checkInDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(record.checkInAt), "h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.method === 'BARCODE' ? 'success' : 'warning'}>
                        {record.method}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {meta.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center text-sm">
              <button
                disabled={meta.page === 1}
                onClick={() => setMeta({ ...meta, page: meta.page - 1 })}
                className="px-4 py-2 border border-input rounded-lg disabled:opacity-50 hover:bg-muted transition-colors font-medium"
              >
                Previous
              </button>
              <span className="text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
              <button
                disabled={meta.page === meta.totalPages}
                onClick={() => setMeta({ ...meta, page: meta.page + 1 })}
                className="px-4 py-2 border border-input rounded-lg disabled:opacity-50 hover:bg-muted transition-colors font-medium"
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
    <div>
      <h2 className="text-xl font-bold mb-6">Memberships & Payments</h2>
      
      <form onSubmit={handleIssue} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8 bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Issue / Renew Plan</label>
          <select required value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm">
            <option value="">Select a Plan...</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} - {p.durationDays} Days</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Payment (ETB)</label>
          <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm" />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm">
              <option value="CASH">CASH</option>
              <option value="BANK">BANK</option>
              <option value="CARD">CARD</option>
            </select>
          </div>
          <button type="submit" className="h-[38px] px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm">
            Issue
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {member.memberships?.map((m: any) => (
          <div key={m.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">{m.plan.name}</h3>
                  <Badge variant={m.status === 'FROZEN' ? 'warning' : (new Date(m.endsAt) < new Date() ? 'neutral' : 'success')}>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{format(new Date(m.startsAt), "MMM d, yyyy")} - {format(new Date(m.endsAt), "MMM d, yyyy")}</p>
                
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="text-muted-foreground mr-1">Payments:</span>
                  {m.payments.length === 0 ? <span className="text-muted-foreground">None</span> : m.payments.map((p: any) => (
                    <Badge key={p.id} variant="neutral">{(p.amountCents / 100).toFixed(2)} ETB ({p.method})</Badge>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => toggleFreeze(m.id, m.status === 'FROZEN')} className="flex-1 md:flex-none text-sm border border-input bg-background px-4 py-2 rounded-lg hover:bg-muted font-medium transition-colors">
                  {m.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                </button>
                <button onClick={() => handleStandalonePayment(m.id)} className="flex-1 md:flex-none text-sm border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary/10 font-medium transition-colors">
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        ))}
        {member.memberships?.length === 0 && (
          <div className="text-center p-8 bg-card border border-border rounded-xl shadow-sm text-muted-foreground">
            No memberships found.
          </div>
        )}
      </div>
    </div>
  );
}
