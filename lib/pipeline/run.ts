import { promises as fs } from "node:fs";
import path from "node:path";
import { intake } from "./stages/intake";
import { extractFrames, ensureThumbnail } from "./stages/extractFrames";
import { matchContext } from "./stages/matchContext";
import { geminiTactical } from "./stages/geminiTactical";
import { geometryPass, applyGeometry } from "./stages/geometryPass";
import { classifyFrames } from "./stages/classifyFrames";
import { selectHeroFrames } from "./stages/selectHeroFrames";
import { strategyImages } from "./stages/strategyImages";
import { strategyScene } from "./stages/strategyScene";
import { cinematicSvg } from "./stages/cinematicSvg";
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

    // Kick off in parallel: match facts, frame extraction, narrative tactical pass.
    const factsPromise = matchContext(clipId, hint);
    const framesPromise = extractFrames(clipId, clipPath, 4);
    const facts = await factsPromise;
    const [analysis, frames] = await Promise.all([
      geminiTactical(clipId, clipPath, facts, hint),
      framesPromise,
    ]);

    const classifications = await classifyFrames(clipId, frames, eventHint);
    const heroes = await selectHeroFrames(clipId, analysis, classifications);

    // For every hero frame: broadcast overlay + top-down schema, all calls in parallel.
    const { topdownMinimaps } = await strategyImages(clipId, heroes, analysis);

    // Geometry solver consumes the per-event top-down schemas.
    const geometry = await geometryPass(clipId, analysis, topdownMinimaps);
    applyGeometry(analysis, geometry);
    await writeJson(clipId, "tactical_analysis.json", analysis);

    const scene = await strategyScene(clipId, analysis, geometry);

    // Cinematic SVG + counterplay can run in parallel: both depend only on the analysis+scene.
    await Promise.all([
      cinematicSvg(clipId, analysis, topdownMinimaps).catch((err) => {
        console.warn("cinematicSvg failed", err);
        return null;
      }),
      counterplay(clipId, analysis, scene, hint),
    ]);

    await fs.writeFile(
      path.join(process.cwd(), "analysis", clipId, "index.json"),
      JSON.stringify({ clipId, heroFrames: heroes.map((h) => h.event.id) }, null, 2),
    );

    return { clipId, ok: true };
  } catch (err: any) {
    console.error("pipeline error", err);
    emitStage(input.clipId, "intake", "error", String(err?.message ?? err));
    return { clipId, ok: false, error: String(err?.message ?? err) };
  }
}
