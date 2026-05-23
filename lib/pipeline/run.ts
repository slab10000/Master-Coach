import { promises as fs } from "node:fs";
import path from "node:path";
import { intake } from "./stages/intake";
import { extractFrames, ensureThumbnail } from "./stages/extractFrames";
import { matchContext } from "./stages/matchContext";
import { geminiTactical } from "./stages/geminiTactical";
import { topdownMinimaps } from "./stages/topdownMinimaps";
import { geometryPass, applyGeometry } from "./stages/geometryPass";
import { classifyFrames } from "./stages/classifyFrames";
import { selectHeroFrames } from "./stages/selectHeroFrames";
import { annotateFrames } from "./stages/annotateFrames";
import { strategyScene } from "./stages/strategyScene";
import { counterplay } from "./stages/counterplay";
import { emitStage } from "./events";
import { writeJson } from "@/lib/fs/analysis";
import type { MatchHint } from "@/lib/types";

export interface PipelineInput {
  clipId: string;
  clipPath: string;
  hint?: MatchHint;
}

export interface PipelineOutput {
  clipId: string;
  ok: boolean;
  error?: string;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { clipId, clipPath, hint } = input;
  try {
    await ensureThumbnail(clipId, clipPath);
    await intake(clipId, clipPath);

    const eventHint =
      [hint?.competition, hint?.match, hint?.minute, hint?.event].filter(Boolean).join(" ") ||
      "football match";

    // Kick everything off in parallel as early as we can:
    //  - match context (text) → feeds tactical narrative
    //  - frame extraction (ffmpeg) → feeds minimaps + classifier
    //  - narrative tactical pass (video → events, no coords)
    // As soon as frames land, fire ALL minimap image-gen requests at once.
    const factsPromise = matchContext(clipId, hint);
    const framesPromise = extractFrames(clipId, clipPath, 4);

    const minimapsPromise = framesPromise.then((frames) =>
      topdownMinimaps(clipId, frames, 6),
    );

    const facts = await factsPromise;
    const analysisPromise = geminiTactical(clipId, clipPath, facts, hint);

    const [analysis, frames, minimaps] = await Promise.all([
      analysisPromise,
      framesPromise,
      minimapsPromise,
    ]);

    // Geometry pass needs both the narrative events and the minimaps.
    const geometry = await geometryPass(clipId, analysis, minimaps);
    applyGeometry(analysis, geometry);
    // Persist the enriched analysis so the UI reads merged coords.
    await writeJson(clipId, "tactical_analysis.json", analysis);

    const classifications = await classifyFrames(clipId, frames, eventHint);
    const heroes = await selectHeroFrames(clipId, analysis, classifications);
    const heroFrames = await annotateFrames(clipId, heroes, analysis);
    const scene = await strategyScene(clipId, analysis, geometry);
    await counterplay(clipId, analysis, scene, hint);

    await fs.writeFile(
      path.join(process.cwd(), "analysis", clipId, "index.json"),
      JSON.stringify({ clipId, heroFrames: heroFrames.map((h) => h.eventId) }, null, 2),
    );

    return { clipId, ok: true };
  } catch (err: any) {
    console.error("pipeline error", err);
    emitStage(input.clipId, "intake", "error", String(err?.message ?? err));
    return { clipId, ok: false, error: String(err?.message ?? err) };
  }
}
