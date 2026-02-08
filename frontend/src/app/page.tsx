"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompanionStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const companionId = useCompanionStore((s) => s.companionId);

  useEffect(() => {
    if (companionId) {
      router.replace("/chat");
    } else {
      router.replace("/ritual");
    }
  }, [companionId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="w-[0.8px] h-[0.8px] rounded-full bg-accent animate-glow-pulse blur-[10px]" />
    </div>
  );
}
