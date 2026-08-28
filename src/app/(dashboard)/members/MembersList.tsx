"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { usePathname } from "next/navigation";

export function MembersList() {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const fetchMembers = async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      
      const res = await fetch(`/api/members?${params.toString()}`);
      if (res.ok) {
        setMembers(await res.json());
      }
    };
    fetchMembers();
  }, [search]);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Members</h2>
          <Link href="/members/new" className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary-hover transition-colors">
            <Plus className="w-4 h-4" />
          </Link>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {members.map(member => {
          const isActive = pathname === `/members/${member.id}`;
          return (
            <Link 
              key={member.id} 
              href={`/members/${member.id}`}
              className={`flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors ${isActive ? 'bg-muted/80' : ''}`}
            >
              <Avatar name={`${member.firstName} ${member.lastName}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.firstName} {member.lastName}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{member.barcode}</p>
                <div className="flex gap-1 mt-1.5">
                  {member.isBlocked && <Badge variant="danger">Blocked</Badge>}
                  {!member.isBlocked && member.memberships?.length > 0 && <Badge variant="success">Active</Badge>}
                </div>
              </div>
            </Link>
          );
        })}
        {members.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No members found.
          </div>
        )}
      </div>
    </div>
  );
}
