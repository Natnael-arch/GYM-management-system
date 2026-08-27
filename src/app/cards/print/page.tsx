"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BarcodeCard } from "@/components/BarcodeCard";

function BulkPrintContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!idsParam) return;
    
    // Fetch all and filter client side for simplicity in v1, 
    // or we could add a bulk endpoint. Since the DB is small, fetching all is fine for now.
    fetch(`/api/members`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          const idSet = new Set(idsParam.split(","));
          setMembers(data.filter((m: any) => idSet.has(m.id)));
        }
      });
  }, [idsParam]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!idsParam) return <div className="p-8">No IDs provided.</div>;
  if (members.length === 0) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white flex flex-col items-center">
      <div className="mb-8 print:hidden">
        <button 
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 text-white rounded shadow font-medium hover:bg-blue-700"
        >
          Print {members.length} Cards
        </button>
        <p className="text-sm text-gray-500 mt-2 text-center">Set printer margins to none, turn off headers/footers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-4 max-w-4xl w-full">
        {members.map(member => (
          <div key={member.id} className="flex justify-center break-inside-avoid mb-4">
            <BarcodeCard member={member} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BulkPrintPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading cards...</div>}>
      <BulkPrintContent />
    </Suspense>
  );
}
