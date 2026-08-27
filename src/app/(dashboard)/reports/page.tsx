"use client";

import { useState, useEffect, useMemo } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { exportToCSV } from "@/lib/csv-export";

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/attendance?from=${fromDate}&to=${toDate}`);
        if (res.ok) {
          setAttendance(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    if (fromDate && toDate) fetchReport();
  }, [fromDate, toDate]);

  // Compute the days array for the table headers
  const days = useMemo(() => {
    if (!fromDate || !toDate) return [];
    try {
      return eachDayOfInterval({ start: new Date(fromDate), end: new Date(toDate) });
    } catch { return []; }
  }, [fromDate, toDate]);

  // Process data for charts and grid
  const { chartData, memberGrid } = useMemo(() => {
    const dayCounts: Record<string, number> = {};
    const mems: Record<string, any> = {};

    // Initialize days
    days.forEach(d => dayCounts[format(d, "MMM d")] = 0);

    attendance.forEach(att => {
      const dayStr = format(new Date(att.checkInDate), "MMM d");
      if (dayCounts[dayStr] !== undefined) dayCounts[dayStr]++;
      
      const mId = att.member.id;
      if (!mems[mId]) {
        mems[mId] = { 
          name: `${att.member.firstName} ${att.member.lastName}`,
          total: 0,
          visits: {} // map of dayStr -> checkInAt time
        };
      }
      mems[mId].total++;
      mems[mId].visits[dayStr] = format(new Date(att.checkInAt), "HH:mm");
    });

    return {
      chartData: Object.entries(dayCounts).map(([day, count]) => ({ day, count })),
      memberGrid: Object.values(mems).sort((a: any, b: any) => b.total - a.total)
    };
  }, [attendance, days]);

  const handleExport = () => {
    const headers = ["Member Name", "Total Visits", ...days.map(d => format(d, "MMM d"))];
    const rows = memberGrid.map((m: any) => [
      m.name,
      m.total,
      ...days.map(d => m.visits[format(d, "MMM d")] || "Absent")
    ]);
    exportToCSV(`Attendance_Report_${fromDate}_to_${toDate}.csv`, headers, rows);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Reports</h1>
          <p className="text-gray-500 mt-1">Visualize and export historical check-ins.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-white border border-gray-300 p-2 rounded-lg">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="outline-none" />
            <span className="text-gray-400">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="outline-none" />
          </div>
          <button 
            onClick={handleExport}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-8 border border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Daily Check-in Trend</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between">
          <h2 className="text-lg font-medium text-gray-900">Member Attendance Grid</h2>
          {loading && <span className="text-sm text-blue-600 animate-pulse">Updating...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Member</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider">Total</th>
                {days.map(d => (
                  <th key={d.toISOString()} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {format(d, "MMM d")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {memberGrid.length === 0 ? (
                <tr><td colSpan={days.length + 2} className="p-8 text-center text-gray-500">No attendance data for this period.</td></tr>
              ) : (
                memberGrid.map((m: any, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                      {m.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center text-blue-600">
                      {m.total}
                    </td>
                    {days.map(d => {
                      const time = m.visits[format(d, "MMM d")];
                      return (
                        <td key={d.toISOString()} className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          {time ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {time}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
