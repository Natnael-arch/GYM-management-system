import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MembersPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-background">
      <EmptyState 
        icon={Users} 
        title="No Member Selected" 
        message="Select a member from the list to view their details, history, and active plans." 
      />
    </div>
  );
}
