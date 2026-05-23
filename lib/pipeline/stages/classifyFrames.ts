import pLimit from "p-limit";
import { emitStage } from "../events";
import { getActiveProvider } from "@/lib/providers/vision";
import { writeJson } from "@/lib/fs/analysis";
import type { FrameClassification } from "@/lib/types";
import type { FrameInfo } from "./extractFrames";

export async function classifyFrames(
  clipId: string,
  frames: FrameInfo[],
  hint: string,
): Promise<FrameClassification[]> {
  const provider = await getActiveProvider();
  emitStage(
    clipId,
    "classifyFrames",
    "started",
    `Classifying ${frames.length} frames via ${provider.name === "google" ? "Google" : "GMI Cloud"}`,
  );

  // Cap frames for cost/time
  const capped = frames.length > 80 ? sampleEvenly(frames, 80) : frames;

  const limit = pLimit(5);
  let done = 0;
  const results = await Promise.all(
    capped.map((f) =>
      limit(async () => {
        const r = await provider.classifyFrame(f.path, f.timestamp, hint);
        done++;
        if (done % 8 === 0) {
          emitStage(clipId, "classifyFrames", "progress", `${done}/${capped.length} frames`, {
            progress: done / capped.length,
          });
        }
        return r;
      }),
    ),
  );

  await writeJson(clipId, "frame_observations.json", { provider: provider.name, results });
  const keyCount = results.filter((r) => r.is_key_moment).length;
  emitStage(clipId, "classifyFrames", "done", `Found ${keyCount} candidate key frames`);
  return results;
}

function sampleEvenly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
