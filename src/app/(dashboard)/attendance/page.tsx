import { CalendarCheck } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

export default function AttendancePage() {
  return (
    <>
      <TopBar
        title="Attendance"
        subtitle="Daily check-in and check-out records"
      />
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md shadow-sm">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto mb-5">
            <CalendarCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Automatically Tracked</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Attendance tracking is managed automatically via the fingerprint scanner and barcode check-in.
            View today&apos;s attendance from the{' '}
            <a href="/" className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity">
              Dashboard
            </a>
            .
          </p>
        </div>
      </div>
    </>
  );
}
