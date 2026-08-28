"use client";

import { useState, useEffect, useMemo } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { exportToCSV } from "@/lib/csv-export";
import { TopBar } from "@/components/layout/TopBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Download } from "lucide-react";

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
    <>
      <TopBar 
        title="Attendance Reports" 
        subtitle="Visualize and export historical check-ins" 
        action={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent border-none text-sm outline-none px-2 focus:ring-0" />
              <span className="text-muted-foreground text-sm">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent border-none text-sm outline-none px-2 focus:ring-0" />
            </div>
            <button 
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg font-medium transition-colors text-sm h-full"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        }
      />
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="bg-card rounded-2xl shadow-sm p-6 border border-border">
          <h2 className="text-lg font-semibold mb-6">Daily Check-in Trend</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{fill: 'var(--color-muted)'}} 
                  contentStyle={{
                    borderRadius: '8px', 
                    border: '1px solid var(--color-border)', 
                    backgroundColor: 'var(--color-card)', 
                    color: 'var(--color-card-foreground)'
                  }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
            <h2 className="text-lg font-semibold">Member Attendance Grid</h2>
            {loading && <span className="text-sm text-primary animate-pulse font-medium">Updating...</span>}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 bg-muted/80 backdrop-blur z-10 font-bold min-w-[150px]">Member</TableHead>
                  <TableHead className="text-center font-bold">Total</TableHead>
                  {days.map(d => (
                    <TableHead key={d.toISOString()} className="text-center whitespace-nowrap">
                      {format(d, "MMM d")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberGrid.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={days.length + 2} className="text-center text-muted-foreground py-8">
                      No attendance data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  memberGrid.map((m: any, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10 border-r border-border/50">
                        {m.name}
                      </TableCell>
                      <TableCell className="text-center font-bold text-primary">
                        {m.total}
                      </TableCell>
                      {days.map(d => {
                        const time = m.visits[format(d, "MMM d")];
                        return (
                          <TableCell key={d.toISOString()} className="text-center">
                            {time ? (
                              <Badge variant="success">{time}</Badge>
                            ) : (
                              <span className="text-muted/50">-</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
