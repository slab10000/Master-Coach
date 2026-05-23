import { emitStage } from "../events";
import type { FrameClassification, TacticalAnalysis, TacticalEvent } from "@/lib/types";

export interface HeroCandidate {
  event: TacticalEvent;
  frame: FrameClassification;
  combinedScore: number;
}

export async function selectHeroFrames(
  clipId: string,
  analysis: TacticalAnalysis,
  classifications: FrameClassification[],
): Promise<HeroCandidate[]> {
  emitStage(clipId, "selectHeroFrames", "started", "Choosing hero moments");
  const candidates: HeroCandidate[] = [];

  const importantTypes = new Set(["pass", "shot", "cross", "run", "carry"]);

  for (const event of analysis.events ?? []) {
    if (!importantTypes.has(event.type)) continue;
    const target = event.start;
    let best: FrameClassification | null = null;
    let bestDist = Infinity;
    for (const f of classifications) {
      const dist = Math.abs(f.timestamp - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = f;
      }
    }
    if (!best) continue;
    if (bestDist > 0.75) continue;
    const eventWeight = event.type === "shot" ? 1.0 : event.tactical_effect ? 0.9 : 0.6;
    const score = eventWeight * (0.4 + 0.6 * (best.confidence ?? 0));
    candidates.push({ event, frame: best, combinedScore: score });
  }

  candidates.sort((a, b) => b.combinedScore - a.combinedScore);
  // dedupe by frame path
  const seen = new Set<string>();
  const top: HeroCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.frame.framePath)) continue;
    seen.add(c.frame.framePath);
    top.push(c);
    if (top.length >= 4) break;
  }

  // Fallback: if classifier missed everything, just take the first 3 important events
  if (top.length === 0) {
    const eventsOnly = (analysis.events ?? [])
      .filter((e) => importantTypes.has(e.type))
      .slice(0, 3);
    for (const event of eventsOnly) {
      let best: FrameClassification | null = null;
      let bestDist = Infinity;
      for (const f of classifications) {
        const dist = Math.abs(f.timestamp - event.start);
        if (dist < bestDist) {
          bestDist = dist;
          best = f;
        }
      }
      if (best) top.push({ event, frame: best, combinedScore: 0.3 });
    }
  }

  emitStage(clipId, "selectHeroFrames", "done", `Selected ${top.length} hero frames`);
  return top;
}
