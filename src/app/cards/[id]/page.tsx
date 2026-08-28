"use client";

import { useState, useEffect, use } from "react";
import { BarcodeCard } from "@/components/BarcodeCard";
import { Printer } from "lucide-react";

export default function SingleCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [member, setMember] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setMember(data);
      });
  }, [id]);

  if (error) return <div className="p-8 text-destructive text-center mt-12">{error}</div>;
  if (!member) return <div className="p-8 text-center mt-12 text-muted-foreground animate-pulse">Loading card...</div>;

  return (
    <div className="min-h-screen bg-background p-8 print:p-0 print:bg-white flex flex-col items-center">
      <div className="mb-8 print:hidden max-w-sm text-center">
        <button 
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print ID Card
        </button>
        <p className="text-sm text-muted-foreground mt-3 bg-muted p-3 rounded-lg border border-border">
          Set printer margins to none, and turn off headers/footers in the print dialog.
        </p>
      </div>

      <BarcodeCard member={member} />
    </div>
  );
}
