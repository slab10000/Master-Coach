import path from "node:path";
import { promises as fs } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import pLimit from "p-limit";
import { Modality } from "@google/genai";
import { emitStage } from "../events";
import { analysisDir, writeJson } from "@/lib/fs/analysis";
import { googleClient } from "@/lib/providers/google";
import { imageMimeType } from "@/lib/providers/imageMime";
import type { FrameInfo } from "./extractFrames";

const execAsync = promisify(exec);

export interface MinimapFrame {
  timestamp: number;
  framePath: string;
  minimapPath: string | null;
}

const MINIMAP_PROMPT = `Use the attached football broadcast frame as a REFERENCE for player positions, then GENERATE a brand new image: a clean 2D top-down tactical diagram of a football pitch (bird's-eye view).

The output image must be:
- A full horizontal football pitch on green grass with crisp white lines: halfway line, center circle, both penalty boxes, both six-yard boxes, both goals, corner arcs. The pitch fills the whole image.
- Attacking direction is LEFT TO RIGHT.
- For each visible player in the reference, draw a small filled circle at their approximate top-down position (lateral position and depth up the pitch). The team in possession uses CYAN circles (#4DD8FF). The defending team uses WHITE circles with a thin dark grey outline.
- The ball is a small white dot with a black outline.
- No crowd, no scoreboard, no broadcast graphics, no faces, no text labels.

This is a NEW illustration, not an edit of the broadcast image. Output the diagram image only.`;

function pickEvenlySpaced<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round(((arr.length - 1) * i) / (n - 1));
    out.push(arr[idx]);
  }
  return out;
}

async function convertToWebp(sourcePath: string, outPath: string): Promise<void> {
  if (sourcePath.toLowerCase().endsWith(".webp")) {
    await fs.copyFile(sourcePath, outPath);
    return;
  }
  await execAsync(`cwebp -quiet -q 82 "${sourcePath}" -o "${outPath}"`);
}

async function renderMinimap(
  framePath: string,
  outPath: string,
): Promise<{ ok: boolean; reason?: string }> {
  const ai = googleClient();
  const model = process.env.GEMINI_IMAGE_EDIT_MODEL ?? "gemini-2.5-flash-image-preview";
  const img = await fs.readFile(framePath);
  try {
    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: MINIMAP_PROMPT },
            { inlineData: { mimeType: imageMimeType(framePath), data: img.toString("base64") } },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        temperature: 0.4,
      },
    });
    const parts = result.candidates?.[0]?.content?.parts ?? [];
    let textBack = "";
    for (const part of parts) {
      const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) {
        const buf = Buffer.from(inline.data, "base64");
        const sourceExt = inline.mimeType?.includes("png")
          ? ".png"
          : inline.mimeType?.includes("webp")
            ? ".webp"
            : ".jpg";
        const sourcePath = `${outPath}.source${sourceExt}`;
        await fs.writeFile(sourcePath, buf);
        try {
          await convertToWebp(sourcePath, outPath);
        } finally {
          await fs.rm(sourcePath, { force: true });
        }
        return { ok: true };
      }
      const t = (part as { text?: string }).text;
      if (t) textBack += t;
    }
    const reason = textBack
      ? `model returned text only: ${textBack.slice(0, 140)}`
      : "no inline image in response";
    return { ok: false, reason };
  } catch (err) {
    return { ok: false, reason: String((err as Error)?.message ?? err) };
  }
}

export async function topdownMinimaps(
  clipId: string,
  frames: FrameInfo[],
  sampleCount = 6,
): Promise<MinimapFrame[]> {
  const samples = pickEvenlySpaced(frames, sampleCount);
  emitStage(
    clipId,
    "topdownMinimaps",
    "started",
    `Rendering ${samples.length} top-down minimaps in parallel`,
  );

  const outDir = path.join(analysisDir(clipId), "minimaps");
  await fs.mkdir(outDir, { recursive: true });

  // Fire ALL image gen requests in parallel (small concurrency cap to avoid provider throttling).
  const limit = pLimit(samples.length);
  let done = 0;
  const failures: string[] = [];
  const results = await Promise.all(
    samples.map((f) =>
      limit(async () => {
        const outPath = path.join(outDir, `minimap_${f.index.toString().padStart(4, "0")}.webp`);
        const { ok, reason } = await renderMinimap(f.path, outPath);
        done++;
        if (!ok) {
          failures.push(`t=${f.timestamp.toFixed(2)}: ${reason}`);
          console.warn(`[topdownMinimaps] t=${f.timestamp.toFixed(2)} failed: ${reason}`);
        }
        emitStage(clipId, "topdownMinimaps", "progress", `Minimap ${done}/${samples.length}`, {
          progress: done / samples.length,
        });
        return {
          timestamp: f.timestamp,
          framePath: f.path,
          minimapPath: ok ? outPath : null,
        } satisfies MinimapFrame;
      }),
    ),
  );
  if (failures.length) {
    emitStage(
      clipId,
      "topdownMinimaps",
      "progress",
      `${failures.length} minimap(s) failed — geometry will fall back to heuristic placement`,
      { payload: { failures } },
    );
  }

  await writeJson(clipId, "minimaps.json", results);
  const ok = results.filter((r) => r.minimapPath).length;
  emitStage(clipId, "topdownMinimaps", "done", `Generated ${ok}/${results.length} minimaps`);
  return results;
}
