import { promises as fs } from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ClipMeta, MatchHint } from "@/lib/types";

const execAsync = promisify(exec);

const INBOX_DIR = path.join(process.cwd(), "clips", "inbox");
const ANALYSIS_DIR = path.join(process.cwd(), "analysis");

const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv"]);

export function clipIdFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

export async function listClips(): Promise<ClipMeta[]> {
  await fs.mkdir(INBOX_DIR, { recursive: true });
  const entries = await fs.readdir(INBOX_DIR);
  const videos = entries.filter((f) => VIDEO_EXTS.has(path.extname(f).toLowerCase()));

  const clips: ClipMeta[] = [];
  for (const filename of videos) {
    const id = clipIdFromFilename(filename);
    const fullPath = path.join(INBOX_DIR, filename);
    const sidecarPath = fullPath.replace(/\.[^.]+$/, ".meta.json");
    let sidecar: MatchHint | undefined;
    try {
      sidecar = JSON.parse(await fs.readFile(sidecarPath, "utf-8"));
    } catch {}

    let duration: number | undefined;
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${fullPath}"`,
      );
      duration = parseFloat(stdout.trim()) || undefined;
    } catch {}

    const analysisFolder = path.join(ANALYSIS_DIR, id);
    let hasCachedAnalysis = false;
    try {
      await fs.access(path.join(analysisFolder, "strategy_scene.json"));
      hasCachedAnalysis = true;
    } catch {}

    let thumbnailPath: string | undefined;
    const thumbDest = path.join(analysisFolder, "thumbnail.webp");
    try {
      await fs.access(thumbDest);
      thumbnailPath = `/api/files/${id}/thumbnail.webp`;
    } catch {
      try {
        await fs.mkdir(analysisFolder, { recursive: true });
        const tempThumb = path.join(analysisFolder, "thumbnail.jpg");
        await execAsync(`ffmpeg -y -ss 00:00:02 -i "${fullPath}" -frames:v 1 -q:v 3 "${tempThumb}"`);
        try {
          await execAsync(`cwebp -quiet -q 82 "${tempThumb}" -o "${thumbDest}"`);
        } finally {
          await fs.rm(tempThumb, { force: true });
        }
        thumbnailPath = `/api/files/${id}/thumbnail.webp`;
      } catch {}
    }

    clips.push({
      id,
      filename,
      path: fullPath,
      durationSeconds: duration,
      thumbnailPath,
      hasCachedAnalysis,
      sidecar,
    });
  }
  return clips;
}

export async function getClipById(clipId: string): Promise<ClipMeta | null> {
  const all = await listClips();
  return all.find((c) => c.id === clipId) ?? null;
}
