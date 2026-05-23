import { EventEmitter } from "node:events";
import type { PipelineEvent, PipelineStage } from "@/lib/types";

const buses = new Map<string, EventEmitter>();

export function getBus(clipId: string): EventEmitter {
  let bus = buses.get(clipId);
  if (!bus) {
    bus = new EventEmitter();
    bus.setMaxListeners(50);
    buses.set(clipId, bus);
  }
  return bus;
}

export function emitStage(
  clipId: string,
  stage: PipelineStage,
  status: PipelineEvent["status"],
  message: string,
  extra: Partial<PipelineEvent> = {},
): void {
  const event: PipelineEvent = {
    stage,
    status,
    message,
    timestamp: Date.now(),
    ...extra,
  };
  getBus(clipId).emit("event", event);
}
