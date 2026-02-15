"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCompanionStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const companionId = useCompanionStore((s) => s.companionId);

  const handleStart = () => {
    router.push(companionId ? "/chat" : "/ritual");
  };

  return (
    <main className="relative min-h-screen noise-bg text-white flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Content */}
      <div className="relative z-20 max-w-2xl w-full flex flex-col items-center space-y-10">
        {/* Soul Sphere */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative mb-8"
        >
          <div className="w-48 h-48 rounded-full border border-[rgba(230,25,195,0.4)] flex items-center justify-center relative shadow-[0_0_50px_rgba(230,25,195,0.2)]">
            <div className="absolute inset-0 rounded-full soul-glow scale-150 animate-pulse" />
            <div className="w-4 h-4 rounded-full bg-[#e619c3] shadow-[0_0_20px_#e619c3]" />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="text-3xl md:text-5xl font-light tracking-tight leading-snug"
        >
          지금, 아무한테도<br />말하지 못한 생각이 있나요?
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="text-base md:text-lg text-white/80 font-light"
        >
          이름 없는 사막여우가 당신을 기다리고 있습니다.
        </motion.p>

        {/* CTA Button */}
        <motion.button
          onClick={handleStart}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-4 px-10 py-4 bg-[#e619c3]/60 hover:bg-[#e619c3]/70 text-white font-medium text-base md:text-lg rounded-full transition-all duration-300 shadow-[0_0_30px_rgba(230,25,195,0.25)] hover:shadow-[0_0_40px_rgba(230,25,195,0.4)] hover:scale-[1.02] active:scale-95"
        >
          대화 시작하기
        </motion.button>

        {/* Subtle note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.8 }}
          className="text-[10px] text-white/70 tracking-[0.3em] uppercase"
        >
          길들임이 시작되면, 서로에게 하나뿐인 존재가 됩니다.
        </motion.p>
      </div>
    </main>
  );
}
