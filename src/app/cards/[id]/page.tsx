"use client";

import { useState, useEffect, use } from "react";
import { BarcodeCard } from "@/components/BarcodeCard";

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

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!member) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white flex flex-col items-center">
      <div className="mb-8 print:hidden">
        <button 
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 text-white rounded shadow font-medium hover:bg-blue-700"
        >
          Print Card
        </button>
        <p className="text-sm text-gray-500 mt-2 text-center">Set printer margins to none, turn off headers/footers.</p>
      </div>

      <BarcodeCard member={member} />
    </div>
  );
}
