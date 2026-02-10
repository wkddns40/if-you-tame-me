"use client";

import { motion } from "framer-motion";

interface ResonanceRippleProps {
  emotionColor?: string | null;
}

export default function ResonanceRipple({ emotionColor }: ResonanceRippleProps) {
  const color = emotionColor || "var(--accent)";

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 8,
            height: 8,
            border: `1.5px solid ${color}`,
          }}
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 25, opacity: 0 }}
          transition={{
            duration: 1.6,
            delay: i * 0.2,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
