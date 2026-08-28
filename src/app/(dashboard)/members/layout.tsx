"use client"

import { SplitPanel } from "@/components/layout/SplitPanel";
import { MembersList } from "./MembersList";
import { TopBar } from "@/components/layout/TopBar";

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar title="Members Directory" />
      <SplitPanel
        left={<MembersList />}
        right={children}
      />
    </>
  );
}
