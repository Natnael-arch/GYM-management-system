"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodeCard({ member }: { member: any }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && member.barcode) {
      JsBarcode(svgRef.current, member.barcode, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 16,
        margin: 10,
      });
    }
  }, [member.barcode]);

  return (
    <div className="w-[85.6mm] h-[54mm] bg-white border border-gray-300 rounded-xl shadow overflow-hidden flex flex-col p-4 relative print:shadow-none print:border-gray-200">
      <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
      
      <div className="flex justify-between items-start mt-2">
        <div className="flex-1">
          <h1 className="text-sm font-bold text-gray-800 uppercase tracking-widest">Gym Access</h1>
          <h2 className="text-xl font-bold mt-2 leading-tight">{member.firstName} <br/>{member.lastName}</h2>
        </div>
        {member.photoUrl ? (
          <img src={member.photoUrl} alt="Photo" className="w-16 h-16 rounded object-cover border border-gray-200" />
        ) : (
          <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400 border border-gray-200">
            No Photo
          </div>
        )}
      </div>

      <div className="mt-auto flex justify-center pb-2">
        <svg ref={svgRef} className="w-full h-auto max-h-[80px]"></svg>
      </div>
    </div>
  );
}
