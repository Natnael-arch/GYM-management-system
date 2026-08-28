"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csv-export";
import { DualDate } from "@/components/ui/DualDate";

export default function TodayAttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchToday = async () => {
    try {
      const res = await fetch("/api/attendance/today");
      const data = await res.json();
      if (data.data) {
        setRecords(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch today's attendance", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
    // Poll every 10 seconds
    const interval = setInterval(fetchToday, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    const headers = ["Member Name", "Barcode", "Check-in Time", "Method"];
    const rows = records.map(r => [
      `${r.member.firstName} ${r.member.lastName}`,
      r.member.barcode,
      format(new Date(r.checkInAt), "HH:mm:ss"),
      r.method
    ]);
    exportToCSV(`Attendance_Today_${format(new Date(), "yyyy-MM-dd")}.csv`, headers, rows);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Today's Attendance</h1>
          <p className="text-gray-500 mt-1">Live feed of members checking in today.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold">
            Total: {records.length}
          </div>
          <button 
            onClick={handleExport}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && records.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">No check-ins yet today.</td></tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        {record.member.photoUrl ? (
                          <img className="h-10 w-10 rounded-full object-cover" src={record.member.photoUrl} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                            {record.member.firstName[0]}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {record.member.firstName} {record.member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{record.member.barcode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900"><DualDate date={record.checkInAt} includeTime short /></div>
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
      </div>
    </div>
  );
}
