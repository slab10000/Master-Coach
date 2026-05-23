import { NextRequest } from "next/server";
import { createReadStream, promises as fs } from "node:fs";
import { getClipById } from "@/lib/fs/clips";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ clipId: string }> },
) {
  const { clipId } = await ctx.params;
  const clip = await getClipById(clipId);
  if (!clip) return new Response("not found", { status: 404 });
  const stat = await fs.stat(clip.path);
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    const stream = createReadStream(clip.path, { start, end });
    return new Response(stream as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": "video/mp4",
      },
    });
  }
  const stream = createReadStream(clip.path);
  return new Response(stream as any, {
    headers: { "Content-Type": "video/mp4", "Content-Length": String(stat.size) },
  });
}
