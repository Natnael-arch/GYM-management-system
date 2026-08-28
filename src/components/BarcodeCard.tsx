"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Dumbbell } from "lucide-react";

export function BarcodeCard({ member }: { member: any }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && member.barcode) {
      JsBarcode(svgRef.current, member.barcode, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 14,
        margin: 5,
        lineColor: "#0f172a", // Very dark navy/black for contrast
      });
    }
  }, [member.barcode]);

  return (
    <div className="w-[85.6mm] h-[54mm] bg-white border border-gray-300 rounded-xl shadow-lg flex flex-col p-4 relative overflow-hidden print:shadow-none print:border-gray-200">
      {/* Accent Header */}
      <div className="absolute top-0 left-0 w-full h-12 bg-indigo-600 flex items-center px-4">
        <Dumbbell className="w-5 h-5 text-white mr-2" />
        <span className="text-white font-bold tracking-widest uppercase text-xs">Gym Access</span>
      </div>
      
      <div className="flex justify-between items-start mt-10 z-10">
        <div className="flex-1 pr-2">
          <h2 className="text-xl font-extrabold leading-tight text-gray-900 tracking-tight">
            {member.firstName} <br/>{member.lastName}
          </h2>
          <p className="text-[10px] font-semibold text-indigo-600 uppercase mt-1 tracking-wider">Member</p>
        </div>
        {member.photoUrl ? (
          <img src={member.photoUrl} alt="Photo" className="w-16 h-16 rounded-lg object-cover border-2 border-white shadow-sm bg-gray-50" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 border border-gray-200 font-medium text-center shadow-sm">
            No Photo
          </div>
        )}
      </div>

      <div className="mt-auto flex justify-center pb-1">
        <svg ref={svgRef} className="w-full h-auto max-h-[70px]"></svg>
      </div>
    </div>
  );
}
