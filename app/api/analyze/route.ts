import { NextRequest } from "next/server";
import { getClipById } from "@/lib/fs/clips";
import { runPipeline } from "@/lib/pipeline/run";
import { getBus } from "@/lib/pipeline/events";
import type { PipelineEvent, MatchHint } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { clipId, hint } = (await req.json()) as { clipId: string; hint?: MatchHint };
  const clip = await getClipById(clipId);
  if (!clip) return new Response("clip not found", { status: 404 });

  const encoder = new TextEncoder();
  const bus = getBus(clipId);

  const stream = new ReadableStream({
    start(controller) {
      const onEvent = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      bus.on("event", onEvent);

      // Kick off pipeline (async, do not await in stream start)
      runPipeline({ clipId, clipPath: clip.path, hint: hint ?? clip.sidecar })
        .then((result) => {
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify(result)}\n\n`),
          );
          bus.off("event", onEvent);
          controller.close();
        })
        .catch((err) => {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: String(err?.message ?? err) })}\n\n`,
            ),
          );
          bus.off("event", onEvent);
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
