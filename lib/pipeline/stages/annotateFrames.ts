import path from "node:path";
import pLimit from "p-limit";
import { emitStage } from "../events";
import { analysisDir, writeJson } from "@/lib/fs/analysis";
import { annotateFrame } from "@/lib/providers/nanoBanana";
import type { HeroFrame, TacticalAnalysis } from "@/lib/types";
import type { HeroCandidate } from "./selectHeroFrames";

function buildPrompt(c: HeroCandidate, analysis: TacticalAnalysis): string {
  const e = c.event;
  const focusColor = "electric cyan (#4DD8FF)";
  const opponentColor = "soft red (#FF4D3D)";
  const color = e.team === "focus" ? focusColor : opponentColor;
  const fromXY =
    e.from?.x !== undefined && e.from?.y !== undefined
      ? `near pitch coordinate (${Math.round(e.from.x)}, ${Math.round(e.from.y)})`
      : "the ball carrier";
  const toXY =
    e.to?.x !== undefined && e.to?.y !== undefined
      ? `to pitch coordinate (${Math.round(e.to.x)}, ${Math.round(e.to.y)})`
      : "the intended receiver";

  let actionDesc: string;
  switch (e.type) {
    case "pass":
    case "cross":
    case "switch":
      actionDesc = `Draw a bold ${color} arrow with a soft glowing halo representing a ${e.type} from ${fromXY} ${toXY}. The arrow should curve naturally along the ball's flight.`;
      break;
    case "shot":
      actionDesc = `Draw a bold ${color} arrow with a soft halo and a small target marker representing a shot ${toXY}.`;
      break;
    case "run":
    case "carry":
      actionDesc = `Draw a dashed ${color} arrow representing a player run ${fromXY} ${toXY}.`;
      break;
    case "press":
      actionDesc = `Draw a thin red-orange pressing line from the defender ${fromXY} ${toXY}.`;
      break;
    default:
      actionDesc = `Draw a ${color} arrow from ${fromXY} ${toXY}.`;
  }

  const spaceNote = e.tactical_effect
    ? `If relevant, add a translucent gold zone (15% opacity) highlighting the area of advantage: ${e.tactical_effect}.`
    : "";

  return `Annotate this football broadcast frame as a tactical analyst overlay.
Event: ${e.description}
${actionDesc}
${spaceNote}`;
}

export async function annotateFrames(
  clipId: string,
  candidates: HeroCandidate[],
  analysis: TacticalAnalysis,
): Promise<HeroFrame[]> {
  emitStage(clipId, "annotateFrames", "started", `Drawing ${candidates.length} tactical overlays`);
  const outDir = path.join(analysisDir(clipId), "hero_frames");
  const limit = pLimit(3);
  let done = 0;
  const results = await Promise.all(
    candidates.map((c) =>
      limit(async () => {
        const outPath = path.join(outDir, `${c.event.id}.png`);
        const prompt = buildPrompt(c, analysis);
        await annotateFrame({ framePath: c.frame.framePath, outPath, prompt });
        done++;
        emitStage(
          clipId,
          "annotateFrames",
          "progress",
          `Annotated ${done}/${candidates.length}`,
          { progress: done / candidates.length },
        );
        const hero: HeroFrame = {
          eventId: c.event.id,
          framePath: `/api/files/${clipId}/frames/${path.basename(c.frame.framePath)}`,
          annotatedPath: `/api/files/${clipId}/hero_frames/${c.event.id}.png`,
          timestamp: c.event.start,
          caption: c.event.tactical_effect || c.event.description,
        };
        return hero;
      }),
    ),
  );
  await writeJson(clipId, "hero_frames.json", results);
  emitStage(clipId, "annotateFrames", "done", `Drew ${results.length} broadcast overlays`);
  return results;
}
