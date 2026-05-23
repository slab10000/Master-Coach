import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Globe2,
  Network,
  Play,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { listClips } from "@/lib/fs/clips";
import { ProviderToggle } from "@/components/landing/ProviderToggle";
import { formatDuration } from "@/lib/utils";
import type { ClipMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

const confetti = [
  { x: 6, delay: -1.2, duration: 8.4, color: "#F5C451", w: 7, h: 18 },
  { x: 11, delay: -4.1, duration: 9.1, color: "#4DD8FF", w: 5, h: 14 },
  { x: 17, delay: -7.4, duration: 10.2, color: "#FF4D3D", w: 8, h: 17 },
  { x: 23, delay: -2.8, duration: 7.6, color: "#F8F5EC", w: 5, h: 16 },
  { x: 29, delay: -5.3, duration: 9.8, color: "#35D06E", w: 8, h: 15 },
  { x: 34, delay: -0.7, duration: 8.9, color: "#F5C451", w: 6, h: 19 },
  { x: 39, delay: -6.2, duration: 11.3, color: "#4DD8FF", w: 6, h: 16 },
  { x: 44, delay: -3.6, duration: 8.1, color: "#FF4D3D", w: 9, h: 14 },
  { x: 49, delay: -8.8, duration: 10.9, color: "#F5C451", w: 5, h: 18 },
  { x: 54, delay: -1.9, duration: 9.3, color: "#F8F5EC", w: 7, h: 15 },
  { x: 59, delay: -5.9, duration: 8.5, color: "#35D06E", w: 6, h: 17 },
  { x: 63, delay: -4.5, duration: 10.6, color: "#F5C451", w: 8, h: 18 },
  { x: 68, delay: -7.1, duration: 9.6, color: "#4DD8FF", w: 5, h: 15 },
  { x: 73, delay: -2.2, duration: 8.8, color: "#FF4D3D", w: 8, h: 16 },
  { x: 78, delay: -6.7, duration: 11.2, color: "#F8F5EC", w: 6, h: 18 },
  { x: 83, delay: -3.1, duration: 9.9, color: "#35D06E", w: 7, h: 14 },
  { x: 88, delay: -8.2, duration: 10.4, color: "#F5C451", w: 8, h: 17 },
  { x: 94, delay: -4.8, duration: 8.6, color: "#4DD8FF", w: 5, h: 16 },
  { x: 14, delay: -9.4, duration: 12.2, color: "#F5C451", w: 4, h: 12 },
  { x: 32, delay: -10.7, duration: 13.1, color: "#FF4D3D", w: 5, h: 13 },
  { x: 52, delay: -11.5, duration: 12.8, color: "#F8F5EC", w: 4, h: 14 },
  { x: 71, delay: -9.9, duration: 13.6, color: "#35D06E", w: 5, h: 12 },
  { x: 91, delay: -12.4, duration: 12.5, color: "#F5C451", w: 4, h: 13 },
];

const pipelineSteps = [
  {
    label: "Match Context",
    detail: "Web tools gather match and team data",
    icon: Globe2,
  },
  {
    label: "AI Understanding",
    detail: "Gemini builds structured match JSON",
    icon: Sparkles,
  },
  {
    label: "Play Breakdown",
    detail: "Vision extracts the tactical story",
    icon: Network,
  },
  {
    label: "Strategy Engine",
    detail: "Recreate movement, passes, and zones",
    icon: ShieldCheck,
  },
  {
    label: "Counter Plays",
    detail: "RocketRide returns coach fixes",
    icon: Rocket,
  },
];

export default async function LandingPage() {
  const clips = await listClips();
  const featuredClip = clips[0];

  return (
    <main className="world-cup-landing relative flex h-screen flex-col overflow-hidden">
      <div className="landing-background" aria-hidden="true" />
      <div className="landing-vignette" aria-hidden="true" />

      <div className="confetti-field" aria-hidden="true">
        {confetti.map((piece, index) => (
          <span
            key={`${piece.x}-${index}`}
            className="confetti-piece"
            style={
              {
                "--x": `${piece.x}%`,
                "--delay": `${piece.delay}s`,
                "--duration": `${piece.duration}s`,
                "--color": piece.color,
                "--w": `${piece.w}px`,
                "--h": `${piece.h}px`,
                "--drift": `${index % 2 === 0 ? 42 : -38}px`,
                "--spin": `${index % 3 === 0 ? 420 : -360}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <header className="absolute left-0 right-0 top-0 z-30 mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center border border-gold-400/70 bg-black/30 shadow-[0_0_30px_rgba(245,196,81,0.18)] backdrop-blur">
            <Trophy className="h-6 w-6 text-gold-400 transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div>
            <div className="font-display text-3xl leading-none tracking-[0.11em] text-chalk drop-shadow">
              MASTER COACH
            </div>
            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-gold-400">
              World Cup Tactical Lens
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <ProviderToggle />
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-xs font-semibold text-white/75 shadow-2xl backdrop-blur md:flex">
            <Rocket className="h-4 w-4 text-chalk" />
            RocketRide
            <span className="ml-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              Local Mode
            </span>
          </div>
        </div>
      </header>

      <section className="relative z-20 mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 items-center gap-6 px-5 pb-4 pt-[5.5rem] sm:px-8 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.68fr)] lg:px-10 lg:pb-4 lg:pt-[4.5rem]">
        <div className="relative z-20 max-w-[900px]">
          <div className="landing-date mb-4 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.36em] text-gold-400">
            <span className="text-gold-400/70">//</span>
            <span>Saturday</span>
            <span className="text-white/35">May 23</span>
            <span className="text-white/35">2026</span>
            <span className="hidden text-white/35 sm:inline">San Francisco</span>
          </div>

          <h1 className="landing-title max-w-5xl font-display text-7xl leading-[0.8] tracking-[0.025em] text-chalk drop-shadow-[0_8px_40px_rgba(0,0,0,0.55)] sm:text-8xl lg:text-[5.2rem] xl:text-[5.4rem] 2xl:text-8xl">
            THE COACH THAT
            <span className="block text-gold-400">WATCHES EVERY PLAY</span>
          </h1>

          <p className="landing-copy mt-4 max-w-2xl text-base leading-6 text-white/82 sm:text-lg">
            Drop a clip. Master Coach breaks it down with AI, builds the tactical
            story, and helps your team win the next moment.
          </p>

          <HeroClipPanel clip={featuredClip} clipCount={clips.length} />
        </div>

        <CoachStage />
      </section>

      <section className="relative z-30 mx-auto w-full max-w-[1800px] shrink-0 px-5 pb-4 sm:px-8 lg:px-10">
        <PipelineStrip />
      </section>
    </main>
  );
}

function HeroClipPanel({
  clip,
  clipCount,
}: {
  clip?: ClipMeta;
  clipCount: number;
}) {
  if (!clip) {
    return <EmptyState />;
  }

  return (
    <div className="hero-clip-panel mt-4 grid max-w-[650px] overflow-hidden border border-gold-400/35 bg-black/38 shadow-[0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_184px]">
      <div className="p-3 sm:p-4">
        <div className="hero-clip-header mb-3 flex items-center gap-3">
          <div className="font-display text-2xl tracking-wider text-emerald-300">
            CLIP INBOX
          </div>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-400/90 px-2 text-sm font-black text-pitch-900">
            {clipCount}
          </span>
          <span className="text-sm text-white/55">
            clip{clipCount === 1 ? "" : "s"} ready
          </span>
        </div>

        <Link
          href={`/analyze/${clip.id}`}
          className="group block overflow-hidden border border-white/14 bg-pitch-900/70 transition hover:border-gold-400/55"
        >
          <div className="hero-clip-media relative h-[176px] overflow-hidden bg-pitch-900 sm:h-[192px]">
            {clip.thumbnailPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clip.thumbnailPath}
                alt={clip.filename}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="pitch-stripes h-full w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white/85 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {clip.hasCachedAnalysis ? "Cached" : "New"}
            </div>
            <div className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white/90">
              {formatDuration(clip.durationSeconds)}
            </div>
          </div>
          <div className="hero-clip-meta px-4 py-3">
            <div className="hero-clip-title font-display text-2xl leading-none tracking-wide text-chalk sm:text-3xl">
              {clip.sidecar?.match ?? prettifyName(clip.filename)}
            </div>
            <div className="mt-1 text-sm text-emerald-300/90">
              {clip.sidecar?.event ?? clip.sidecar?.competition ?? "Local tactical clip"}
            </div>
          </div>
        </Link>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 p-3 sm:p-4 md:border-l md:border-t-0">
        <Link
          href={`/analyze/${clip.id}?run=1`}
          className="hero-launch group flex min-h-[118px] flex-1 flex-col items-center justify-center gap-2 bg-gold-400 px-4 py-4 text-center text-pitch-900 shadow-[0_18px_60px_rgba(245,196,81,0.24)] transition hover:bg-gold-500"
        >
          <Play className="h-8 w-8 fill-pitch-900 transition-transform group-hover:scale-110" />
          <span className="font-display text-3xl leading-none tracking-wide">
            Launch Analysis
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.16em]">
            Start tactical breakdown
          </span>
        </Link>

        {clip.hasCachedAnalysis ? (
          <Link
            href={`/analyze/${clip.id}`}
            className="hero-secondary-action flex items-center justify-center gap-3 border border-white/14 bg-black/30 px-4 py-4 text-sm font-semibold text-white/80 backdrop-blur transition hover:border-white/40 hover:text-white"
          >
            <FolderOpen className="h-5 w-5 text-chalk" />
            <span>
              Open Cached Board
              <span className="block font-mono text-[11px] font-normal text-white/45">
                analysis/{clip.id}/
              </span>
            </span>
          </Link>
        ) : (
          <div className="hero-secondary-action flex items-center justify-center gap-3 border border-white/14 bg-black/30 px-4 py-4 text-sm font-semibold text-white/70 backdrop-blur">
            <FolderOpen className="h-5 w-5 text-chalk" />
            <span>
              Inbox Path
              <span className="block font-mono text-[11px] font-normal text-white/45">
                ./clips/inbox/
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CoachStage() {
  return (
    <div className="coach-stage pointer-events-none relative z-10 hidden h-full min-h-[520px] lg:block">
      <div className="coach-video-shell absolute bottom-[-12px] right-[96px] z-20 w-[min(47vw,720px)]">
        <video
          src="/landing/coach-talkin.webm"
          poster="/landing/coach-cutout.png"
          className="coach-video h-auto w-full select-none drop-shadow-[0_42px_70px_rgba(0,0,0,0.68)]"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      </div>

      <div className="trophy-layer absolute bottom-[-22px] right-[-14px] z-10 w-[190px] opacity-95 xl:right-4 xl:w-[250px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/trophy.png"
          alt=""
          className="h-auto w-full drop-shadow-[0_30px_70px_rgba(245,196,81,0.18)]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function PipelineStrip() {
  return (
    <div className="landing-pipeline border border-white/12 bg-black/55 p-2 shadow-[0_22px_80px_rgba(0,0,0,0.44)] backdrop-blur-xl sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="pipeline-title font-display text-xl tracking-wider text-emerald-300">
          FROM CLIP TO COUNTER-PLAY
        </div>
        <div className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-white/42 md:block">
          Powered by Gemini · GMI Cloud · RocketRide
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-5">
        {pipelineSteps.map((step, index) => {
          const Icon = step.icon;

          return (
            <div
              key={step.label}
              className="pipeline-step relative flex items-center gap-3 border border-white/10 bg-white/[0.035] p-2"
            >
              <div className="pipeline-icon flex h-10 w-10 shrink-0 items-center justify-center border border-white/12 bg-white/[0.055]">
                <Icon className="h-5 w-5 text-chalk" />
              </div>
              <div>
                <div className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-white/90">
                  {step.label}
                </div>
                <div className="pipeline-detail mt-1 text-xs leading-4 text-white/48">
                  {step.detail}
                </div>
              </div>
              {index < pipelineSteps.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-gold-400 lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 max-w-[760px] border border-dashed border-gold-400/35 bg-black/42 p-8 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-10">
      <div className="flex items-center gap-3">
        <Search className="h-8 w-8 text-gold-400" />
        <div>
          <div className="font-display text-4xl leading-none tracking-wider text-chalk">
            WAITING FOR THE FIRST CLIP
          </div>
          <div className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            ./clips/inbox/
          </div>
        </div>
      </div>
      <div className="mt-5 max-w-xl text-sm leading-6 text-white/62">
        Drop an <code className="font-mono text-gold-400">.mp4</code> or{" "}
        <code className="font-mono text-gold-400">.mov</code> file into{" "}
        <span className="font-mono text-gold-400">clips/inbox/</span> and
        refresh. Add a matching{" "}
        <span className="font-mono text-gold-400">*.meta.json</span> when you
        want sharper match context.
      </div>
    </div>
  );
}

function prettifyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
