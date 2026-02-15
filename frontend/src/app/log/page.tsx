"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCompanionStore } from "@/lib/store";
import EmotionCalendar from "@/components/EmotionCalendar";
import GemCollection from "@/components/GemCollection";

export default function LogPage() {
  const router = useRouter();
  const companionId = useCompanionStore((s) => s.companionId);
  const companionName = useCompanionStore((s) => s.companionName);
  const userId = useCompanionStore((s) => s.userId);

  useEffect(() => {
    if (!companionId) {
      router.replace("/ritual");
    }
  }, [companionId, router]);

  if (!companionId || !userId) return null;

  return (
    <div className="min-h-screen noise-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04]">
        <span className="font-serif text-sm text-white/50">If You Tame Me</span>
        <div className="flex items-center gap-4">
          <Link
            href="/chat"
            className="text-[11px] uppercase tracking-[0.15em] text-white/30 hover:text-accent transition-colors"
          >
            Chat
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-lg mx-auto px-6 py-10 space-y-14">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="font-serif text-2xl text-white/80">
            {companionName}&apos;s Prism
          </h1>
          <p className="text-xs text-white/25">Emotional landscape over time</p>
        </div>

        {/* Calendar */}
        <EmotionCalendar companionId={companionId} />

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/15">Gems</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Gems */}
        <GemCollection userId={userId} companionId={companionId} />
      </div>
    </div>
  );
}
