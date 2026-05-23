import { listClips } from "@/lib/fs/clips";
import { ClipCard } from "@/components/landing/ClipCard";
import { ProviderToggle } from "@/components/landing/ProviderToggle";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const clips = await listClips();

  return (
    <div className="min-h-screen relative">
      {/* header */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-400 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-pitch-900" />
          </div>
          <div>
            <div className="font-display text-2xl tracking-[0.15em] leading-none">
              MASTER COACH
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-1">
              World Cup Tactical Lens
            </div>
          </div>
        </div>
        <ProviderToggle />
      </header>

      {/* hero */}
      <section className="relative px-8 pt-12 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.5em] text-gold-400 mb-4 font-mono">
            // Saturday · May 23 · 2026 · San Francisco
          </div>
          <h1 className="font-display text-7xl md:text-8xl leading-[0.9] tracking-wide">
            <span className="text-chalk">Watch the play.</span>
            <br />
            <span className="shimmer-text">Coach the moment.</span>
          </h1>
          <p className="mt-6 text-white/60 text-lg max-w-2xl">
            Drop a football clip into <code className="font-mono text-gold-400/90 text-sm">clips/inbox</code>. Master Coach researches the match, watches the play like an elite analyst, and turns it into a tactical board with broadcast-grade overlays and coach fixes.
          </p>
        </div>
      </section>

      {/* clips */}
      <section className="px-8 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="font-display text-3xl tracking-wider">CLIP INBOX</div>
              <div className="text-xs text-white/40 font-mono mt-1">
                {clips.length} clip{clips.length === 1 ? "" : "s"} detected
              </div>
            </div>
            <div className="text-xs text-white/40 font-mono">
              ./clips/inbox/
            </div>
          </div>

          {clips.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {clips.map((clip, i) => (
                <ClipCard key={clip.id} clip={clip} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="px-8 pb-10 text-center text-[10px] uppercase tracking-[0.4em] text-white/30 font-mono">
        Powered by Gemini · GMI Cloud · RocketRide
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-12 text-center">
      <div className="font-display text-3xl tracking-wider text-white/70">
        WAITING FOR THE FIRST CLIP
      </div>
      <div className="mt-3 text-white/50 max-w-md mx-auto text-sm">
        Drop an <code className="font-mono text-gold-400">.mp4</code> or <code className="font-mono text-gold-400">.mov</code> file into
        <span className="font-mono text-gold-400"> clips/inbox/ </span>
        and refresh this page. Optionally include a sidecar
        <span className="font-mono text-gold-400"> *.meta.json </span>
        with match hints for sharper analysis.
      </div>
    </div>
  );
}
