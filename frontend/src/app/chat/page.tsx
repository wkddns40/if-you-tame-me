"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCompanionStore } from "@/lib/store";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
  const router = useRouter();
  const companionId = useCompanionStore((s) => s.companionId);
  const companionName = useCompanionStore((s) => s.companionName);

  useEffect(() => {
    if (!companionId) {
      router.replace("/ritual");
    }
  }, [companionId, router]);

  if (!companionId) return null;

  return (
    <div className="flex flex-col h-screen noise-bg">
      {/* Nav bar */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04]">
        <span className="font-serif text-sm text-white/50">If You Tame Me</span>
        <div className="flex items-center gap-4">
          <Link
            href="/log"
            className="text-[11px] uppercase tracking-[0.15em] text-white/30 hover:text-accent transition-colors"
          >
            Log
          </Link>
        </div>
      </nav>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          companionId={companionId}
          companionName={companionName}
        />
      </div>
    </div>
  );
}
