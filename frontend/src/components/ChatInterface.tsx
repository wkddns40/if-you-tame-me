"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResonanceRipple from "./ResonanceRipple";
import { useCompanionStore } from "@/lib/store";

interface ChatMessage {
  id: string;
  sender: "USER" | "AI";
  text: string;
  isStreaming?: boolean;
  intent?: string;
  emotionColor?: string | null;
}

interface ChatInterfaceProps {
  companionId: string;
  companionName?: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1";

export default function ChatInterface({
  companionId,
  companionName = "Companion",
}: ChatInterfaceProps) {
  const backgroundImage = useCompanionStore((s) => s.backgroundImage);
  const userName = useCompanionStore((s) => s.userName);
  const setUserName = useCompanionStore((s) => s.setUserName);
  const setCompanionName = useCompanionStore((s) => s.setCompanionName);
  const userNameRef = useRef(userName);
  userNameRef.current = userName;
  const hasGreetedRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [displayName, setDisplayName] = useState(companionName);
  const [nameRevealing, setNameRevealing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // WebSocket connection
  useEffect(() => {
    let cancelled = false;
    const ws = new WebSocket(`${WS_URL}/ws/${companionId}`);

    ws.onopen = () => {
      if (!cancelled) {
        wsRef.current = ws;
        setIsConnected(true);
      }
    };

    ws.onclose = () => {
      if (!cancelled) {
        setIsConnected(false);
      }
    };

    ws.onmessage = (event) => {
      if (cancelled) return;

      let data: { type?: string; content?: string; error?: string; intent?: string; emotion_color?: string | null };
      try {
        data = JSON.parse(event.data);
      } catch {
        console.warn("WebSocket: failed to parse message", event.data);
        return;
      }

      if (data.type === "greeting") {
        hasGreetedRef.current = true;
        setMessages((prev) => [
          ...prev,
          {
            id: `greeting-${Date.now()}`,
            sender: "AI" as const,
            text: data.content ?? "",
            isStreaming: false,
          },
        ]);
      } else if (data.type === "stream") {
        // Check/set ref OUTSIDE the updater to avoid StrictMode double-invocation bug
        if (!streamingIdRef.current) {
          const newId = `ai-${Date.now()}`;
          streamingIdRef.current = newId;
          setMessages((prev) => [
            ...prev,
            { id: newId, sender: "AI", text: data.content ?? "", isStreaming: true },
          ]);
        } else {
          const streamId = streamingIdRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, text: m.text + (data.content ?? "") } : m
            )
          );
        }
      } else if (data.type === "naming_prompt") {
        // AI asks user to name them
        setMessages((prev) => [
          ...prev,
          {
            id: `naming-${Date.now()}`,
            sender: "AI" as const,
            text: data.content ?? "",
            isStreaming: false,
            intent: "naming_prompt",
          },
        ]);
      } else if (data.type === "name_reveal") {
        // Companion has been named — animate the header
        const newName = data.content ?? "";
        if (newName) {
          setCompanionName(newName);
          setNameRevealing(true);
          setDisplayName(newName);
          setTimeout(() => setNameRevealing(false), 2000);
        }
      } else if (data.type === "user_name_set") {
        // Backend extracted the user's name from their message
        const extractedName = data.content ?? "";
        if (extractedName) {
          setUserName(extractedName);
          userNameRef.current = extractedName;
          hasGreetedRef.current = false;
        }
      } else if (data.type === "announcement") {
        // MBTI personality discovery announcement
        setMessages((prev) => [
          ...prev,
          {
            id: `announcement-${Date.now()}`,
            sender: "AI" as const,
            text: data.content ?? "",
            isStreaming: false,
            intent: "announcement",
          },
        ]);
      } else if (data.type === "end") {
        const streamId = streamingIdRef.current;
        if (streamId) {
          // Streaming existed — finalize it with intent + emotionColor
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? { ...m, isStreaming: false, intent: data.intent, emotionColor: data.emotion_color }
                : m
            )
          );
        } else if (data.content) {
          // No streaming messages were received (e.g. backend error or
          // missed stream chunks). Show the full content as a complete message.
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              sender: "AI" as const,
              text: data.content ?? "",
              isStreaming: false,
              intent: data.intent,
              emotionColor: data.emotion_color,
            },
          ]);
        }
        streamingIdRef.current = null;
      }
    };

    return () => {
      cancelled = true;
      streamingIdRef.current = null;
      ws.close();
    };
  }, [companionId]);

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    wsRef.current.send(JSON.stringify({ message: trimmed, user_name: userNameRef.current }));
    setInput("");
  }, [input, isConnected, setUserName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Photo banner area (Instagram-style) */}
      {backgroundImage && (
        <div className="relative w-full shrink-0" style={{ height: "30vh" }}>
          <img
            src={backgroundImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
        <div className="w-2 h-2 rounded-full" style={{
          backgroundColor: isConnected ? "#e619c3" : "#666",
        }} />
        <AnimatePresence mode="wait">
          <motion.span
            key={displayName}
            initial={nameRevealing ? { opacity: 0, y: -10, scale: 0.9 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`text-sm font-light tracking-wide transition-colors duration-1000 ${
              nameRevealing ? "text-accent" : "text-white/70"
            }`}
          >
            {displayName}
          </motion.span>
        </AnimatePresence>
        {nameRevealing && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0] }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="w-6 h-6 rounded-full bg-accent/30 blur-md absolute left-16"
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex flex-col ${
                msg.sender === "USER" ? "items-end" : "items-start"
              }`}
            >
              {/* Label */}
              <span className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">
                {msg.sender === "USER" ? (userName || "You") : displayName}
              </span>

              {/* Text */}
              <div className="relative overflow-hidden max-w-[80%]">
                {msg.sender === "AI" && !msg.isStreaming && msg.intent === "deep_emotional" && (
                  <ResonanceRipple emotionColor={msg.emotionColor} />
                )}
                <p
                  className={`text-sm leading-relaxed ${
                    msg.sender === "USER"
                      ? "text-white/60"
                      : "text-white/90 font-light"
                  }`}
                >
                  {msg.text}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--accent)] animate-pulse rounded-sm" />
                  )}
                </p>
              </div>

            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/20 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
            className="text-white/30 hover:text-[var(--accent)] transition-colors disabled:opacity-20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
