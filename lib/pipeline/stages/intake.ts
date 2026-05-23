import { exec } from "node:child_process";
import { promisify } from "node:util";
import { emitStage } from "../events";
import { writeJson } from "@/lib/fs/analysis";

const execAsync = promisify(exec);

export interface IntakeResult {
  clipId: string;
  path: string;
  durationSeconds: number;
}

export async function intake(clipId: string, clipPath: string): Promise<IntakeResult> {
  emitStage(clipId, "intake", "started", "Reading clip metadata");
  let duration = 0;
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${clipPath}"`,
    );
    duration = parseFloat(stdout.trim());
  } catch (err) {
    console.error("ffprobe failed", err);
  }
  const result = { clipId, path: clipPath, durationSeconds: duration };
  await writeJson(clipId, "intake.json", result);
  emitStage(clipId, "intake", "done", `Clip duration: ${duration.toFixed(1)}s`);
  return result;
}
