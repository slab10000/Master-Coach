import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ clipId: string; path: string[] }> },
) {
  const { clipId, path: parts } = await ctx.params;
  const dir = path.join(process.cwd(), "clips", "strategy_images", clipId);
  const target = path.join(dir, ...parts);
  if (!target.startsWith(dir)) return new Response("forbidden", { status: 403 });
  try {
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    return new Response(data, {
      headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
