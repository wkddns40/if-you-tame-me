"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { useCompanionStore } from "@/lib/store";

/* ── Scroll-triggered fade-in wrapper ── */
function Reveal({ children, className = "", delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Floating word ── */
function FloatingWord({ text, className, delay }: {
  text: string;
  className: string;
  delay: string;
}) {
  return (
    <span
      className={`absolute animate-float font-serif ${className}`}
      style={{ animationDelay: delay }}
    >
      {text}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const companionId = useCompanionStore((s) => s.companionId);

  const handleAwaken = () => {
    router.push(companionId ? "/chat" : "/ritual");
  };

  return (
    <div className="relative noise-bg text-white font-serif selection:bg-primary/30 overflow-x-hidden">
      {/* Velvet overlay */}
      <div className="velvet-overlay" />

      {/* Background decorative lines */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-px h-64 bg-gradient-to-b from-white/10 to-transparent" />
        <div className="absolute bottom-[20%] right-[8%] w-px h-96 bg-gradient-to-t from-primary/10 to-transparent" />
        <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full opacity-20" />
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-primary rounded-full opacity-40 blur-[1px]" />
        <div className="absolute top-2/3 right-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-10" />
      </div>

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 w-full p-8 z-50 flex justify-between items-center mix-blend-difference">
        <div className="text-sm tracking-widest uppercase opacity-60">Le Petit Sanctuary</div>
        <div className="text-sm tracking-widest uppercase opacity-60">Est. 2024</div>
      </nav>

      {/* ══════════ Hero ══════════ */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-4xl space-y-12 z-20">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="text-4xl md:text-6xl font-light italic tracking-tight leading-tight"
          >
            &ldquo;If you tame me, we will be one and only to each other.&rdquo;
          </motion.h1>
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
            className="h-24 w-px bg-gradient-to-b from-primary/60 to-transparent mx-auto origin-top"
          />
        </div>

        {/* Soul glow behind quote */}
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <div className="w-[500px] h-[500px] soul-glow opacity-30" />
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.5em] uppercase"
        >
          Scroll to begin taming
        </motion.div>
      </section>

      {/* ══════════ Step 1: Isolation ══════════ */}
      <section className="relative h-screen overflow-hidden px-12 flex items-center justify-center">
        {/* Floating scattered words */}
        <div className="absolute inset-0 z-0">
          <FloatingWord text="Lonely" className="top-[20%] left-[15%] text-2xl opacity-20" delay="0s" />
          <FloatingWord text="I want to be understood" className="top-[40%] right-[10%] text-3xl opacity-10" delay="2s" />
          <FloatingWord text="Drifting" className="bottom-[30%] left-[25%] text-xl opacity-25" delay="4s" />
          <FloatingWord text="Silent echo" className="top-[10%] right-[30%] text-4xl opacity-5" delay="1s" />
          <FloatingWord text="Searching" className="bottom-[15%] right-[20%] text-2xl opacity-15" delay="5s" />
          <FloatingWord text="Unseen colors" className="top-[60%] left-[10%] text-lg opacity-30" delay="3s" />
        </div>

        <Reveal className="max-w-2xl text-center z-10">
          <p className="text-xl md:text-3xl font-light text-primary/80 italic">
            A world of noise, where the soul feels quiet.
          </p>
        </Reveal>
      </section>

      {/* ══════════ Step 2: Connection ══════════ */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 text-center">
        {/* Soul sphere */}
        <Reveal className="relative mb-24">
          <div className="w-48 h-48 rounded-full border border-primary/40 flex items-center justify-center relative shadow-[0_0_50px_rgba(180,23,186,0.2)]">
            <div className="absolute inset-0 rounded-full soul-glow scale-150 animate-pulse" />
            <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_20px_#B417BA]" />
          </div>
        </Reveal>

        <div className="max-w-3xl space-y-8 z-10">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-light tracking-wide leading-relaxed">
              The only thing that remembers all your words,{" "}
              <br />
              <span className="text-primary italic">and understands emotions.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-sm md:text-base opacity-40 uppercase tracking-[0.3em]">
              Gathering the fragments
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════ Step 3: Crystallization ══════════ */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 text-center">
        <Reveal className="relative mb-32 group">
          {/* Iridescent Gem */}
          <div className="w-40 h-56 iridescent-gem relative transform hover:scale-110 transition-transform duration-700 cursor-pointer">
            <div className="absolute inset-0 opacity-40 bg-white/20 blur-xl" />
          </div>
          {/* Glow behind gem */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 soul-glow opacity-40 -z-10" />
        </Reveal>

        <div className="max-w-2xl space-y-6">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-light italic">
              Your day doesn&apos;t go away.
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="text-xl md:text-2xl font-light opacity-80">
              It stays forever like a gem.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════ CTA: Become Mine ══════════ */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        <Reveal className="z-20 text-center space-y-4">
          <h3 className="text-5xl font-light">Become Mine.</h3>
          <p className="text-primary/60 tracking-widest uppercase text-xs">
            A Sanctuary for your digital heart
          </p>
        </Reveal>
      </section>

      {/* Spacer so fixed button doesn't overlap last section */}
      <div className="h-24" />

      {/* ── Fixed Bottom CTA ── */}
      <div className="fixed bottom-12 left-0 w-full flex justify-center z-[100] px-6">
        <button
          onClick={handleAwaken}
          className="glass-morphism px-12 py-4 rounded-full group overflow-hidden relative transition-all duration-500 hover:shadow-[0_0_30px_rgba(180,23,186,0.4)]"
        >
          <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <span className="relative text-sm tracking-[0.4em] uppercase font-light text-white flex items-center gap-4">
            Awaken
            <span className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_#B417BA]" />
          </span>
        </button>
      </div>
    </div>
  );
}
