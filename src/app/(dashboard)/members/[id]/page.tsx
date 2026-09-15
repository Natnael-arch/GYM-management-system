"use client";

import { useState, useEffect, use } from "react";
import { DualDate } from "@/components/ui/DualDate";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { Printer, Edit, Fingerprint, CheckCircle2, Loader2, X, ChevronLeft, ChevronRight, Archive } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = { id: string; name: string; durationDays: number; priceCents: number };
type Payment = { id: string; amountCents: number; method: string; paidAt: string };
type Membership = {
  id: string;
  planId: string;
  plan: Plan;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "EXPIRED" | "FROZEN";
  frozenAt: string | null;
  payments: Payment[];
};
type Member = {
  id: string;
  firstName: string;
  lastName: string;
  barcode: string;
  phone?: string;
  photoUrl: string | null;
  isBlocked: boolean;
  biometricEnrolled: boolean;
  deviceUserId: string | null;
  memberships: Membership[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function membershipBadgeVariant(m: Membership): "success" | "warning" | "neutral" {
  if (m.status === "FROZEN") return "warning";
  if (m.status === "EXPIRED" || new Date(m.endsAt) < new Date()) return "neutral";
  return "success";
}

function activeMembership(member: Member): Membership | undefined {
  return member.memberships.find(
    (m) => m.status === "ACTIVE" && new Date(m.endsAt) >= new Date()
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InlinePaymentForm({
  membershipId,
  onSuccess,
  onCancel,
}: {
  membershipId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amount || isNaN(amountCents) || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId, amountCents, method }),
    });
    if (res.ok) {
      onSuccess();
    } else {
      const d = await res.json();
      setError(d.error || "Failed to record payment.");
    }
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex items-center gap-2 pt-2 border-t border-border"
    >
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Amount (ETB)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-32 px-2 py-1 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="px-2 py-1 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="CASH">Cash</option>
        <option value="BANK">Bank</option>
        <option value="CARD">Card</option>
      </select>
      <button
        type="submit"
        disabled={saving}
        className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1 border border-input rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}

function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
  destructive,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  destructive?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{confirmLabel}</span>
        <button
          onClick={async () => {
            setLoading(true);
            await onConfirm();
            setConfirming(false);
            setLoading(false);
          }}
          className={`px-2 py-0.5 rounded text-xs font-semibold ${destructive ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 rounded text-xs border border-input hover:bg-muted"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors ${
        destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function MemberDetailPanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isOwner = (session?.user as any)?.role === "OWNER";

  const [member, setMember] = useState<Member | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Issue form state
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [issueAmount, setIssueAmount] = useState("");
  const [issueMethod, setIssueMethod] = useState("CASH");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Inline payment recording: holds membershipId currently open for payment entry
  const [recordingPaymentFor, setRecordingPaymentFor] = useState<string | null>(null);

  // Biometric enroll modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [devicePin, setDevicePin] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Attendance
  const [history, setHistory] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });

  const refresh = async () => {
    const res = await fetch(`/api/members/${id}`);
    if (res.ok) {
      const data: Member = await res.json();
      setMember(data);
      setDevicePin(data.deviceUserId || "");
    }
  };

  const fetchAttendance = async (page: number) => {
    setAttendanceLoading(true);
    const res = await fetch(`/api/members/${id}/attendance?page=${page}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data.data);
      setMeta(data.meta);
    }
    setAttendanceLoading(false);
  };

  useEffect(() => {
    refresh();
    fetch("/api/plans").then((r) => r.json()).then(setPlans);
  }, [id]);

  useEffect(() => {
    fetchAttendance(meta.page);
  }, [id, meta.page]);

  // Pre-fill amount when plan is selected
  useEffect(() => {
    if (!selectedPlanId) return;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (plan) setIssueAmount((plan.priceCents / 100).toFixed(2));
  }, [selectedPlanId, plans]);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError(null);
    const amountCents = Math.round(parseFloat(issueAmount) * 100);
    if (!issueAmount || isNaN(amountCents) || amountCents <= 0) {
      setIssueError("Payment amount is required.");
      return;
    }
    setIssuing(true);
    const res = await fetch(`/api/members/${id}/memberships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: selectedPlanId,
        paymentAmountCents: amountCents,
        paymentMethod: issueMethod,
      }),
    });
    if (res.ok) {
      setSelectedPlanId("");
      setIssueAmount("");
      refresh();
    } else {
      const d = await res.json();
      setIssueError(d.error || "Failed to issue membership.");
    }
    setIssuing(false);
  };

  const handleEnroll = async () => {
    setEnrollError(null);
    const pin = devicePin.trim() || String(Math.floor(1000 + Math.random() * 9000));
    setDevicePin(pin);
    setEnrolling(true);
    setEnrollStatus("Place finger 3× on the device sensor when prompted...");
    try {
      const res = await fetch("/api/biometrics/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceUserId: pin, name: `${member?.firstName} ${member?.lastName}`.trim(), memberId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollStatus("Enrolled successfully.");
        refresh();
        setTimeout(() => setShowEnrollModal(false), 1500);
      } else {
        setEnrollError(data.error || "Enrollment failed on device.");
      }
    } catch (err: any) {
      setEnrollError(err.message || "Cannot reach device.");
    } finally {
      setEnrolling(false);
    }
  };

  if (!member) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const active = activeMembership(member);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-5 py-5 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          {member.photoUrl ? (
            <img src={member.photoUrl} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
          ) : (
            <Avatar name={`${member.firstName} ${member.lastName}`} className="w-16 h-16 text-xl shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold leading-tight">{member.firstName} {member.lastName}</h1>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{member.barcode}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {member.isBlocked && <Badge variant="danger">Blocked</Badge>}
                  {active ? (
                    <Badge variant="success">Active · expires <DualDate date={active.endsAt} inline short /></Badge>
                  ) : (
                    <Badge variant="neutral">No active membership</Badge>
                  )}
                  {member.biometricEnrolled && (
                    <Badge variant="neutral" className="flex items-center gap-1">
                      <Fingerprint className="w-2.5 h-2.5" /> PIN {member.deviceUserId}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href={`/members/${id}/edit`}
                  className="px-2.5 py-1.5 border border-input rounded-md text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/cards/${id}`}
                  target="_blank"
                  className="px-2.5 py-1.5 border border-input rounded-md text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => { setShowEnrollModal(true); setEnrollStatus(null); setEnrollError(null); }}
                  className="px-2.5 py-1.5 border border-input rounded-md text-xs font-medium hover:bg-muted transition-colors"
                  title={member.biometricEnrolled ? "Re-enroll fingerprint" : "Enroll fingerprint"}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                </button>
                <ConfirmAction
                  label={member.isBlocked ? "Unban" : "Ban"}
                  confirmLabel={member.isBlocked ? "Unban member?" : "Ban member?"}
                  destructive={!member.isBlocked}
                  onConfirm={async () => {
                    const fd = new FormData();
                    fd.append("isBlocked", member.isBlocked ? "false" : "true");
                    const res = await fetch(`/api/members/${id}`, { method: "PATCH", body: fd });
                    if (res.ok) refresh();
                  }}
                />
                {isOwner && (
                  <ConfirmAction
                    label="Archive"
                    confirmLabel="Archive member? This hides them from all lists."
                    destructive
                    onConfirm={async () => {
                      const fd = new FormData();
                      fd.append("isArchived", "true");
                      const res = await fetch(`/api/members/${id}`, { method: "PATCH", body: fd });
                      if (res.ok) router.push("/members");
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Enroll Modal ─────────────────────────────────────────────────── */}
        {showEnrollModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-primary" /> Enroll Fingerprint
                </h3>
                <button onClick={() => setShowEnrollModal(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Member must be at the ZKTeco scanner. Device will prompt to press finger 3 times.</p>
              {enrollError && <p className="text-xs text-destructive">{enrollError}</p>}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Device PIN</label>
                <input
                  type="text"
                  value={devicePin}
                  onChange={(e) => setDevicePin(e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {enrollStatus && (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  {enrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                  {enrollStatus}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowEnrollModal(false)} className="px-3 py-1.5 border border-input rounded-md text-sm hover:bg-muted">Close</button>
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1.5"
                >
                  {enrolling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Capturing...</> : "Start Capture"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Memberships & Payments ───────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Memberships & Payments</h2>

          {/* Issue / Renew form */}
          <form onSubmit={handleIssue} className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-border">
            <div className="flex-1 min-w-40">
              <label className="block text-xs text-muted-foreground mb-1">Plan</label>
              <select
                required
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.durationDays}d · {(p.priceCents / 100).toFixed(0)} ETB</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs text-muted-foreground mb-1">Amount (ETB)</label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                value={issueAmount}
                onChange={(e) => setIssueAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-muted-foreground mb-1">Method</label>
              <select
                value={issueMethod}
                onChange={(e) => setIssueMethod(e.target.value)}
                className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="CARD">Card</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={issuing}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {issuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {active ? "Renew" : "Issue"}
            </button>
            {issueError && <p className="w-full text-xs text-destructive">{issueError}</p>}
          </form>

          {/* Membership list */}
          <div className="space-y-3">
            {member.memberships.length === 0 && (
              <p className="text-sm text-muted-foreground">No memberships.</p>
            )}
            {member.memberships.map((m) => (
              <div key={m.id} className="border border-border rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{m.plan.name}</span>
                      <Badge variant={membershipBadgeVariant(m)}>{m.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <DualDate date={m.startsAt} inline short /> – <DualDate date={m.endsAt} inline short />
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.payments.length === 0 ? (
                        <span className="text-xs text-destructive">No payment recorded</span>
                      ) : (
                        m.payments.map((p) => (
                          <span key={p.id} className="text-xs text-muted-foreground">
                            {(p.amountCents / 100).toFixed(2)} ETB ({p.method})
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <ConfirmAction
                      label={m.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                      confirmLabel={m.status === "FROZEN" ? "Unfreeze membership?" : "Freeze membership?"}
                      onConfirm={async () => {
                        await fetch(`/api/members/${id}/memberships/${m.id}/freeze`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ freeze: m.status !== "FROZEN" }),
                        });
                        refresh();
                      }}
                    />
                    <button
                      onClick={() => setRecordingPaymentFor(recordingPaymentFor === m.id ? null : m.id)}
                      className="text-xs font-medium px-2.5 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      + Payment
                    </button>
                  </div>
                </div>
                {recordingPaymentFor === m.id && (
                  <InlinePaymentForm
                    membershipId={m.id}
                    onSuccess={() => { setRecordingPaymentFor(null); refresh(); }}
                    onCancel={() => setRecordingPaymentFor(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Attendance History ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attendance</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No records.</TableCell></TableRow>
                ) : (
                  history.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell><DualDate date={record.checkInDate} inline short /></TableCell>
                      <TableCell className="text-muted-foreground"><DualDate date={record.checkInAt} includeTime inline short /></TableCell>
                      <TableCell><Badge variant={record.method === "BARCODE" ? "neutral" : "warning"}>{record.method}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <button
                disabled={meta.page === 1}
                onClick={() => setMeta({ ...meta, page: meta.page - 1 })}
                className="flex items-center gap-1 px-2 py-1 border border-input rounded hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button
                disabled={meta.page === meta.totalPages}
                onClick={() => setMeta({ ...meta, page: meta.page + 1 })}
                className="flex items-center gap-1 px-2 py-1 border border-input rounded hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
