"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, CheckCircle2, Loader2 } from "lucide-react";

export default function AddMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [deviceUserId, setDeviceUserId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared save logic — used by both manual submit and auto-save after fingerprint
  const saveMember = async (resolvedPin?: string): Promise<boolean> => {
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("phone", phone);
    const pin = resolvedPin ?? deviceUserId;
    if (pin) formData.append("deviceUserId", pin);
    if (fileInputRef.current?.files?.[0]) {
      formData.append("photo", fileInputRef.current.files[0]);
    }

    const res = await fetch("/api/members", { method: "POST", body: formData });

    if (res.ok) {
      const member = await res.json();
      setSaved(true);
      // Navigate to the new member's profile after showing the success state
      setTimeout(() => router.push(`/members/${member.id}`), 1500);
      return true;
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create member.");
      setLoading(false);
      return false;
    }
  };

  const handleEnrollFingerprint = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter first and last name before enrolling fingerprint.");
      return;
    }
    setError("");
    const pin = deviceUserId.trim() || String(Math.floor(1000 + Math.random() * 9000));
    setDeviceUserId(pin);
    setEnrolling(true);
    setEnrollStatus("Place finger 3× on device sensor when prompted...");

    try {
      const res = await fetch("/api/biometrics/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUserId: pin,
          name: `${firstName} ${lastName}`.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollSuccess(true);
        setEnrollStatus("Fingerprint captured — saving member...");
        // Auto-save immediately after successful capture
        await saveMember(pin);
      } else {
        setEnrollStatus(null);
        setError(data.error || "Enrollment failed on device. Try again.");
      }
    } catch (err: any) {
      setEnrollStatus(null);
      setError(err?.message || "Failed to reach device.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveMember();
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <p className="text-sm font-semibold text-foreground">Member created successfully</p>
          <p className="text-xs text-muted-foreground">Opening profile...</p>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-xl mx-auto px-5 py-6 space-y-5">
        <h1 className="text-base font-semibold">New Member</h1>

        {error && (
          <p className="text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              capture="user"
              ref={fileInputRef}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
            />
          </div>

          {/* Biometric section */}
          <div className="border border-border rounded-lg px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className={`w-4 h-4 ${enrollSuccess ? "text-success" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">Fingerprint Enrollment</span>
              </div>
              {enrollSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Device PIN (auto-assigned)"
                value={deviceUserId}
                onChange={(e) => setDeviceUserId(e.target.value)}
                className="flex-1 border border-input bg-background rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleEnrollFingerprint}
                disabled={enrolling || loading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {enrolling ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Capturing...</>
                ) : enrollSuccess ? (
                  "Re-capture"
                ) : (
                  "Capture & Save"
                )}
              </button>
            </div>

            {enrollStatus && (
              <p className={`text-xs ${enrollSuccess ? "text-success" : "text-muted-foreground"}`}>
                {enrollStatus}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Capturing fingerprint will enroll on the ZKTeco device and save the member automatically.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-1.5 border border-input bg-background rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || enrolling}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : "Save Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
