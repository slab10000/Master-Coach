import { promises as fs } from "node:fs";
import path from "node:path";
import { intake } from "./stages/intake";
import { extractFrames, ensureThumbnail } from "./stages/extractFrames";
import { matchContext } from "./stages/matchContext";
import { geminiTactical } from "./stages/geminiTactical";
import { classifyFrames } from "./stages/classifyFrames";
import { selectHeroFrames } from "./stages/selectHeroFrames";
import { annotateFrames } from "./stages/annotateFrames";
import { strategyScene } from "./stages/strategyScene";
import { counterplay } from "./stages/counterplay";
import { emitStage } from "./events";
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

    // Run intake first
    await intake(clipId, clipPath);

    const eventHint =
      [hint?.competition, hint?.match, hint?.minute, hint?.event].filter(Boolean).join(" ") ||
      "football match";

    // Parallel block: match context (also drives tactical analysis) || frame extraction
    const factsPromise = matchContext(clipId, hint);
    const framesPromise = extractFrames(clipId, clipPath, 4);
    const facts = await factsPromise;
    const [analysis, frames] = await Promise.all([
      geminiTactical(clipId, clipPath, facts, hint),
      framesPromise,
    ]);

    const classifications = await classifyFrames(clipId, frames, eventHint);
    const heroes = await selectHeroFrames(clipId, analysis, classifications);
    const heroFrames = await annotateFrames(clipId, heroes, analysis);
    const scene = await strategyScene(clipId, analysis);
    await counterplay(clipId, analysis, scene, hint);

    // best-effort: write a summary index
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
