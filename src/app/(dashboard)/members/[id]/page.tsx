"use client";

import { useState, useEffect, use } from "react";
import { DualDate } from "@/components/ui/DualDate";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { Printer, Edit, Fingerprint, CheckCircle2, Loader2, X } from "lucide-react";

export default function MemberDetailPanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [member, setMember] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [devicePin, setDevicePin] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const fetchMember = async () => {
    const res = await fetch(`/api/members/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMember(data);
      setDevicePin(data.deviceUserId || "");
    }
  };

  useEffect(() => {
    fetchMember();
  }, [id]);

  const handleEnroll = async () => {
    setEnrollError(null);
    const pin = devicePin.trim() || String(Math.floor(1000 + Math.random() * 9000));
    setDevicePin(pin);
    setEnrolling(true);
    setEnrollStatus("Place finger 3 times on the device sensor when prompted...");

    try {
      const res = await fetch("/api/biometrics/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUserId: pin,
          name: `${member.firstName} ${member.lastName}`.trim(),
          memberId: id
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollStatus("Fingerprint enrolled and linked successfully!");
        fetchMember();
        setTimeout(() => setShowEnrollModal(false), 2000);
      } else {
        setEnrollError(data.error || "Enrollment failed on device.");
      }
    } catch (err: any) {
      setEnrollError(err.message || "Failed to communicate with device");
    } finally {
      setEnrolling(false);
    }
  };

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

  const [testingScan, setTestingScan] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTestScan = async () => {
    setTestingScan(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: member.barcode, method: 'BIOMETRIC' })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.allowed) {
        await fetch('/api/access/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'unlock', seconds: 3 })
        });
      }
      fetchHistory();
      setTimeout(() => setTestResult(null), 5000);
    } catch (err: any) {
      setTestResult({ allowed: false, reason: err.message });
    } finally {
      setTestingScan(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [id, meta.page]);

  if (!member) return <div className="p-8 text-center text-muted-foreground flex-1 flex items-center justify-center">Loading profile...</div>;

  const activeMembership = member.memberships?.find((m: any) => m.status === 'ACTIVE' && new Date(m.endsAt) >= new Date());

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 lg:p-10 relative">
      <div className="max-w-4xl mx-auto space-y-8">
        {testResult && (
          <div className={`p-4 rounded-xl border flex items-center justify-between ${testResult.allowed ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">
                  {testResult.allowed ? "Access Granted — Locker Unlocked & Attendance Logged!" : `Access Denied (${testResult.reason || 'Not allowed'})`}
                </p>
                {testResult.checkedInAt && (
                  <p className="text-xs opacity-80 mt-0.5">Checked in at: {new Date(testResult.checkedInAt).toLocaleTimeString()}</p>
                )}
              </div>
            </div>
            <button onClick={() => setTestResult(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
          </div>
        )}

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
                  <Badge variant="success">Active until <DualDate date={activeMembership.endsAt} inline short /></Badge>
                ) : (
                  <Badge variant="neutral">No Active Membership</Badge>
                )}
                <Badge variant={member.biometricEnrolled ? "success" : "neutral"} className="flex gap-1 items-center">
                  <Fingerprint className="w-3 h-3" />
                  {member.biometricEnrolled ? `Biometrics Enrolled (PIN: ${member.deviceUserId})` : "Biometrics Not Enrolled"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
            <button 
              onClick={handleTestScan}
              disabled={testingScan}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {testingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              Test Scan
            </button>
            <button 
              onClick={() => {
                setShowEnrollModal(true);
                setEnrollStatus(null);
                setEnrollError(null);
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium rounded-lg transition-colors"
            >
              <Fingerprint className="w-4 h-4" />
              {member.biometricEnrolled ? "Re-enroll" : "Enroll Finger"}
            </button>
            <Link 
              href={`/members/${id}/edit`} 
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-input bg-background hover:bg-muted text-sm font-medium rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
            <Link 
              href={`/cards/${id}`} 
              target="_blank" 
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary-hover text-sm font-medium rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Card
            </Link>
          </div>
        </div>

        {/* Enroll Fingerprint Modal */}
        {showEnrollModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-primary" />
                  Enroll Fingerprint on Device
                </h3>
                <button 
                  onClick={() => setShowEnrollModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Ensure member is at the ZKTeco scanner. The device will beep and prompt to press the finger 3 times.
              </p>

              {enrollError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                  {enrollError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Device PIN / ID</label>
                <input 
                  type="text" 
                  value={devicePin}
                  onChange={(e) => setDevicePin(e.target.value)}
                  placeholder="Auto-generated (e.g. 101)"
                  className="w-full border border-input bg-background rounded-lg p-2.5 text-sm"
                />
              </div>

              {enrollStatus && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary font-medium flex items-center gap-2">
                  {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {enrollStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 border border-input bg-background rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
                <button 
                  type="button" 
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
                >
                  {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" /> Capturing...</> : "Start Capture"}
                </button>
              </div>
            </div>
          </div>
        )}

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
                      <DualDate date={record.checkInDate} inline short />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <DualDate date={record.checkInAt} includeTime inline short />
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
                <div className="text-sm text-muted-foreground mt-1 flex gap-1">
                  <DualDate date={m.startsAt} inline short /> - <DualDate date={m.endsAt} inline short />
                </div>
                
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
