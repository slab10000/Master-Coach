import { promises as fs } from "node:fs";
import path from "node:path";

const ANALYSIS_DIR = path.join(process.cwd(), "analysis");

export function analysisDir(clipId: string): string {
  return path.join(ANALYSIS_DIR, clipId);
}

export async function ensureAnalysisDir(clipId: string): Promise<string> {
  const dir = analysisDir(clipId);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, "frames"), { recursive: true });
  await fs.mkdir(path.join(dir, "hero_frames"), { recursive: true });
  return dir;
}

export async function writeJson(clipId: string, name: string, data: unknown): Promise<void> {
  const dir = await ensureAnalysisDir(clipId);
  await fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2), "utf-8");
}

export async function readJson<T = unknown>(clipId: string, name: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(analysisDir(clipId), name), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
