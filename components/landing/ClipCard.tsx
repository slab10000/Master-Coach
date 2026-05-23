"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Play, History, Clock } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import type { ClipMeta } from "@/lib/types";

export function ClipCard({ clip, index }: { clip: ClipMeta; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden border border-white/12 bg-black/42 shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
      <div className="aspect-video bg-pitch-900 relative overflow-hidden">
        {clip.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnailPath}
            alt={clip.filename}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="pitch-stripes w-full h-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {clip.hasCachedAnalysis ? (
            <span className="text-[10px] uppercase tracking-widest font-black bg-gold-400 text-pitch-900 px-2 py-0.5">
              Cached
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest font-black bg-broadcast text-pitch-900 px-2 py-0.5">
              New
            </span>
          )}
          {clip.sidecar?.competition && (
            <span className="text-[10px] uppercase tracking-widest font-medium text-white/70 bg-black/45 backdrop-blur px-2 py-0.5 border border-white/10">
              {clip.sidecar.competition}
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-white/85 text-xs font-mono bg-black/65 backdrop-blur px-2 py-1">
          <Clock className="w-3 h-3" />
          {formatDuration(clip.durationSeconds)}
        </div>
      </div>

      <div className="p-4">
        <div className="font-display text-2xl tracking-wide text-chalk leading-tight truncate">
          {clip.sidecar?.match ?? prettifyName(clip.filename)}
        </div>
        {clip.sidecar?.event && (
          <div className="text-xs text-white/50 mt-1 line-clamp-1">
            {clip.sidecar.event}
            {clip.sidecar.minute && ` · ${clip.sidecar.minute}'`}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/analyze/${clip.id}?run=1`}
            className="flex-1 flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-pitch-900 font-black px-3 py-2 text-sm transition"
          >
            <Play className="w-3.5 h-3.5 fill-pitch-900" />
            Analyze
          </Link>
          {clip.hasCachedAnalysis && (
            <Link
              href={`/analyze/${clip.id}`}
              className="flex items-center justify-center gap-2 border border-white/15 hover:border-white/40 text-white px-3 py-2 text-sm transition"
            >
              <History className="w-3.5 h-3.5" />
              Open
            </Link>
          )}
        </div>
      </div>

      <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
    </motion.div>
  );
}

function prettifyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
