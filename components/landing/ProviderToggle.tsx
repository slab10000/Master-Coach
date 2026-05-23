"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProviderToggle() {
  const [provider, setProvider] = useState<"google" | "gmi">("google");
  const [gmiConfigured, setGmiConfigured] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setProvider(d.provider);
        setGmiConfigured(d.gmiConfigured);
      });
  }, []);

  async function setActive(p: "google" | "gmi") {
    setLoading(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p }),
    });
    setProvider(p);
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur px-1.5 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 pl-2 pr-1">Vision</span>
      <button
        onClick={() => setActive("google")}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition",
          provider === "google"
            ? "bg-gold-400 text-pitch-900"
            : "text-white/70 hover:text-white",
        )}
      >
        <Sparkles className="w-3 h-3" />
        Google
      </button>
      <button
        onClick={() => setActive("gmi")}
        disabled={loading || !gmiConfigured}
        title={!gmiConfigured ? "GMI key not set — console recovering" : undefined}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition",
          provider === "gmi"
            ? "bg-broadcast text-pitch-900"
            : "text-white/70 hover:text-white",
          !gmiConfigured && "opacity-40 cursor-not-allowed",
        )}
      >
        <Cpu className="w-3 h-3" />
        GMI Cloud
        {!gmiConfigured && <span className="ml-1 text-[9px] uppercase">offline</span>}
      </button>
      {loading && (
        <motion.div
          className="w-1.5 h-1.5 bg-gold-400 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      )}
    </div>
  );
}
