import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { promises as fs } from "node:fs";
import { emitStage } from "../events";
import { analysisDir, ensureAnalysisDir } from "@/lib/fs/analysis";

const execAsync = promisify(exec);

export interface FrameInfo {
  index: number;
  timestamp: number;
  path: string;
}

export async function extractFrames(
  clipId: string,
  clipPath: string,
  fps = 4,
): Promise<FrameInfo[]> {
  emitStage(clipId, "extractFrames", "started", `Sampling frames at ${fps}fps`);
  const dir = await ensureAnalysisDir(clipId);
  const framesDir = path.join(dir, "frames");
  for (const f of await fs.readdir(framesDir).catch(() => [])) {
    if (f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png") || f.endsWith(".webp")) {
      await fs.unlink(path.join(framesDir, f));
    }
  }
  const pattern = path.join(framesDir, "frame_%04d.jpg");
  await execAsync(
    `ffmpeg -y -i "${clipPath}" -vf fps=${fps} -q:v 3 "${pattern}"`,
  );
  const extracted = (await fs.readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
  for (const file of extracted) {
    const jpgPath = path.join(framesDir, file);
    const webpPath = jpgPath.replace(/\.jpg$/i, ".webp");
    await execAsync(`cwebp -quiet -q 80 "${jpgPath}" -o "${webpPath}"`);
    await fs.unlink(jpgPath);
  }
  const files = (await fs.readdir(framesDir)).filter((f) => f.endsWith(".webp")).sort();
  const frames: FrameInfo[] = files.map((f, i) => ({
    index: i,
    timestamp: i / fps,
    path: path.join(framesDir, f),
  }));
  emitStage(clipId, "extractFrames", "done", `Extracted ${frames.length} frames`, {
    payload: { count: frames.length },
  });
  return frames;
}

export async function ensureThumbnail(clipId: string, clipPath: string): Promise<void> {
  const dir = analysisDir(clipId);
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, "thumbnail.webp");
  try {
    await fs.access(out);
    return;
  } catch {}
  const temp = path.join(dir, "thumbnail.jpg");
  await execAsync(`ffmpeg -y -ss 00:00:02 -i "${clipPath}" -frames:v 1 -q:v 3 "${temp}"`);
  try {
    await execAsync(`cwebp -quiet -q 82 "${temp}" -o "${out}"`);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
