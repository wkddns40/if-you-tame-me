"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { InventoryItem } from "@/lib/api";
import { fetchInventory, crystallize } from "@/lib/api";

interface GemCollectionProps {
  userId: string;
  companionId: string;
}

export default function GemCollection({ userId, companionId }: GemCollectionProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchInventory(userId)
      .then((data) => setItems(data.filter((i) => i.item_type === "MEMORY_GEM")))
      .catch(console.error);
  }, [userId]);

  const handleCrystallize = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await crystallize(companionId, userId);
      // Refetch inventory
      const data = await fetchInventory(userId);
      setItems(data.filter((i) => i.item_type === "MEMORY_GEM"));
      // Select the new gem
      const newGem = data.find((i) => i.item_id === result.item_id);
      if (newGem) setSelected(newGem);
    } catch (err) {
      console.error("Crystallize error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-white/70">Memory Gems</h2>
        <button
          onClick={handleCrystallize}
          disabled={isGenerating}
          className="px-4 py-2 rounded-full text-xs bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all disabled:opacity-40"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
              Crystallizing...
            </span>
          ) : (
            "Crystallize this month"
          )}
        </button>
      </div>

      {/* Gem grid */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/20 text-sm">
            No gems yet. Chat more and crystallize your emotions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <motion.button
              key={item.item_id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(item)}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-surface border border-white/[0.06] hover:border-accent/20 transition-all"
            >
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt="Memory Gem"
                  className="w-full h-full object-cover"
                />
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <span className="text-[10px] text-white/60">
                  {(item.metadata as Record<string, string>)?.emotion || "Memory"}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full rounded-3xl overflow-hidden bg-surface border border-white/[0.08]"
            >
              {selected.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.image_url}
                  alt="Memory Gem Detail"
                  className="w-full aspect-square object-cover"
                />
              )}
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        (selected.metadata as Record<string, string>)?.color_hex || "#a882ff",
                      boxShadow: `0 0 10px 3px ${(selected.metadata as Record<string, string>)?.color_hex || "#a882ff"}66`,
                    }}
                  />
                  <span className="font-serif text-white/80">
                    {(selected.metadata as Record<string, string>)?.emotion || "Memory Gem"}
                  </span>
                </div>
                <p className="text-xs text-white/30">
                  {new Date(selected.acquired_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {" / "}
                  {(selected.metadata as Record<string, string>)?.source_days || "?"} days of emotions
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="w-full py-2.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40 text-xs hover:text-white/60 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
