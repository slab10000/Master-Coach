import { promises as fs } from "node:fs";
import { Type } from "@google/genai";
import { googleClient } from "@/lib/providers/google";
import { imageMimeType } from "@/lib/providers/imageMime";
import { emitStage } from "../events";
import { writeJson } from "@/lib/fs/analysis";
import type { TacticalAnalysis } from "@/lib/types";
import type { MinimapFrame } from "./topdownMinimaps";

export interface EventGeometry {
  event_id: string;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

export interface PlayerSample {
  team: "focus" | "opponent";
  number?: number;
  role?: string;
  t: number;
  x: number;
  y: number;
}

export interface BallSample {
  t: number;
  x: number;
  y: number;
}

export interface GeometrySolution {
  attacking_direction: "left_to_right" | "right_to_left";
  event_geometry: EventGeometry[];
  player_samples: PlayerSample[];
  ball_samples: BallSample[];
}

const GEOMETRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    attacking_direction: { type: Type.STRING, enum: ["left_to_right", "right_to_left"] },
    event_geometry: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          event_id: { type: Type.STRING },
          from: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
            required: ["x", "y"],
          },
          to: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
            required: ["x", "y"],
          },
        },
        required: ["event_id"],
      },
    },
    player_samples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          team: { type: Type.STRING, enum: ["focus", "opponent"] },
          number: { type: Type.NUMBER },
          role: { type: Type.STRING },
          t: { type: Type.NUMBER },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
        },
        required: ["team", "t", "x", "y"],
      },
    },
    ball_samples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          t: { type: Type.NUMBER },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
        },
        required: ["t", "x", "y"],
      },
    },
  },
  required: ["attacking_direction", "event_geometry", "player_samples", "ball_samples"],
};

export async function geometryPass(
  clipId: string,
  analysis: TacticalAnalysis,
  minimaps: MinimapFrame[],
): Promise<GeometrySolution> {
  const usable = minimaps.filter((m) => m.minimapPath);
  emitStage(
    clipId,
    "geometryPass",
    "started",
    `Solving pitch geometry from ${usable.length} top-down minimaps`,
  );

  if (usable.length === 0) {
    const fallback = heuristicGeometry(analysis);
    await writeJson(clipId, "geometry.json", fallback);
    emitStage(
      clipId,
      "geometryPass",
      "done",
      `No usable minimaps — synthesized heuristic geometry for ${fallback.event_geometry.length} events`,
    );
    return fallback;
  }

  const ai = googleClient();
  const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

  const eventsBrief = (analysis.events ?? []).map((e) => ({
    id: e.id,
    t: [e.start, e.end],
    type: e.type,
    team: e.team,
    from: { number: e.from?.number, role: e.from?.role, name: e.from?.name },
    to: { number: e.to?.number, role: e.to?.role, name: e.to?.name },
    description: e.description,
  }));

  const textPrompt = `You are a football geometry solver. You are given:
- A list of tactical events (already analyzed narratively).
- A series of top-down tactical diagrams of the play at known timestamps. In these diagrams ELECTRIC CYAN circles are the team in possession (focus team in possession events) and WHITE circles are the defending team. The ball is a small white dot.

Use a normalized pitch coordinate system: x in [0,100] (left to right), y in [0,68] (bottom to top). Attacking direction in the diagrams is left to right.

Your job: for each event, infer the (x,y) of the action's "from" location and "to" location at the event's start/end timestamps, using the closest minimap(s) in time and reasoning about how things moved between them.

Also output:
- attacking_direction (always "left_to_right" for these diagrams).
- player_samples: per visible player per minimap timestamp, give team / number (if shown) / role (if known from the events list) / t / x / y. Include 6–14 players per minimap.
- ball_samples: ball x/y at each minimap timestamp (one per minimap).

EVENTS:
${JSON.stringify(eventsBrief, null, 2)}

Use the event_id values exactly. Be geometrically consistent across timestamps — players should not teleport.`;

  const imageParts = await Promise.all(
    usable.map(async (m) => {
      const buf = await fs.readFile(m.minimapPath!);
      return {
        inlineData: {
          mimeType: imageMimeType(m.minimapPath!),
          data: buf.toString("base64"),
        },
      };
    }),
  );

  const timestampLabels = usable
    .map((m, i) => `Minimap ${i + 1}: t=${m.timestamp.toFixed(2)}s`)
    .join("\n");

  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: textPrompt },
          { text: `Minimap timestamps:\n${timestampLabels}` },
          ...imageParts,
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: GEOMETRY_SCHEMA,
      temperature: 0.2,
    },
  });

  const solution = JSON.parse(result.text ?? "{}") as GeometrySolution;
  // Clamp everything into the pitch.
  const clampPt = (p?: { x: number; y: number }) =>
    p
      ? { x: Math.min(100, Math.max(0, p.x)), y: Math.min(68, Math.max(0, p.y)) }
      : undefined;
  solution.event_geometry = (solution.event_geometry ?? []).map((g) => ({
    event_id: g.event_id,
    from: clampPt(g.from),
    to: clampPt(g.to),
  }));
  solution.player_samples = (solution.player_samples ?? []).map((s) => ({
    ...s,
    x: Math.min(100, Math.max(0, s.x)),
    y: Math.min(68, Math.max(0, s.y)),
  }));
  solution.ball_samples = (solution.ball_samples ?? []).map((s) => ({
    ...s,
    x: Math.min(100, Math.max(0, s.x)),
    y: Math.min(68, Math.max(0, s.y)),
  }));

  // If the model returned nothing useful, fall back to the heuristic so the board still looks right.
  if (solution.event_geometry.length === 0) {
    const fallback = heuristicGeometry(analysis);
    await writeJson(clipId, "geometry.json", fallback);
    emitStage(
      clipId,
      "geometryPass",
      "done",
      `Model returned empty geometry; using heuristic for ${fallback.event_geometry.length} events`,
    );
    return fallback;
  }

  await writeJson(clipId, "geometry.json", solution);
  emitStage(
    clipId,
    "geometryPass",
    "done",
    `Solved geometry for ${solution.event_geometry.length} events, ${solution.player_samples.length} player samples`,
  );
  return solution;
}

// Synthesize plausible left-to-right coordinates from event roles + sequencing.
// Used when minimap generation fails so the strategy board still shows a sensible play.
function heuristicGeometry(analysis: TacticalAnalysis): GeometrySolution {
  const events = analysis.events ?? [];
  const event_geometry: EventGeometry[] = [];

  // Rough role → pitch coords for a left-to-right attacking shape (x in [0,100], y in [0,68]).
  const roleSpot = (role: string | undefined, team: "focus" | "opponent"): { x: number; y: number } => {
    const r = (role ?? "").toUpperCase();
    // Defending team mirrors the field (sits deeper from focus' POV).
    const defenderShift = team === "opponent" ? 30 : 0;
    if (/GK/.test(r)) return { x: 5 + defenderShift, y: 34 };
    if (/RB|RWB/.test(r)) return { x: 25 + defenderShift, y: 12 };
    if (/LB|LWB/.test(r)) return { x: 25 + defenderShift, y: 56 };
    if (/RCB|CB1/.test(r)) return { x: 18 + defenderShift, y: 26 };
    if (/LCB|CB2/.test(r)) return { x: 18 + defenderShift, y: 42 };
    if (/CB|DEF/.test(r)) return { x: 18 + defenderShift, y: 34 };
    if (/DM|CDM/.test(r)) return { x: 35 + defenderShift, y: 34 };
    if (/RM|RCM/.test(r)) return { x: 50 + defenderShift, y: 22 };
    if (/LM|LCM/.test(r)) return { x: 50 + defenderShift, y: 46 };
    if (/CM|MID/.test(r)) return { x: 50 + defenderShift, y: 34 };
    if (/AM|CAM|10/.test(r)) return { x: 65 + defenderShift, y: 34 };
    if (/RW|RF/.test(r)) return { x: 78 + defenderShift, y: 14 };
    if (/LW|LF/.test(r)) return { x: 78 + defenderShift, y: 54 };
    if (/CF|ST|9/.test(r)) return { x: 82 + defenderShift, y: 34 };
    return { x: 55, y: 34 };
  };

  // Walk events in time order; advance the ball forward (toward x=100) on passes/carries/runs.
  const sorted = [...events].sort((a, b) => a.start - b.start);
  let cursorX = 30;
  let cursorY = 34;
  for (const e of sorted) {
    let from = e.from?.role
      ? roleSpot(e.from.role, e.team)
      : { x: cursorX, y: cursorY };
    let to: { x: number; y: number };
    if (e.to?.role) {
      to = roleSpot(e.to.role, e.team);
    } else if (e.type === "shot") {
      to = { x: 95, y: 34 };
    } else if (e.type === "press" || e.type === "tackle") {
      to = { x: from.x - 5, y: from.y };
    } else {
      // Default: nudge forward (toward attacking direction) and slightly toward center.
      to = { x: Math.min(95, from.x + 12), y: 34 + (from.y - 34) * 0.5 };
    }
    // For opponent events, mirror x so they attack from the right.
    if (e.team === "opponent") {
      from = { x: 100 - from.x, y: from.y };
      to = { x: 100 - to.x, y: to.y };
    }
    event_geometry.push({ event_id: e.id, from, to });
    cursorX = to.x;
    cursorY = to.y;
  }

  // Build coarse player_samples at t=0 from any roles seen in events.
  const player_samples: PlayerSample[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    for (const side of ["from", "to"] as const) {
      const p = e[side];
      if (!p?.role) continue;
      const key = `${e.team}-${p.number ?? p.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const spot = roleSpot(p.role, e.team);
      const x = e.team === "opponent" ? 100 - spot.x : spot.x;
      player_samples.push({
        team: e.team,
        number: p.number,
        role: p.role,
        t: 0,
        x,
        y: spot.y,
      });
    }
  }

  const ball_samples: BallSample[] = event_geometry.flatMap((g, i) =>
    g.from && g.to
      ? [
          { t: sorted[i].start, x: g.from.x, y: g.from.y },
          { t: sorted[i].end, x: g.to.x, y: g.to.y },
        ]
      : [],
  );

  return {
    attacking_direction: "left_to_right",
    event_geometry,
    player_samples,
    ball_samples,
  };
}

export function applyGeometry(analysis: TacticalAnalysis, geometry: GeometrySolution): void {
  const map = new Map(geometry.event_geometry.map((g) => [g.event_id, g]));
  for (const e of analysis.events ?? []) {
    const g = map.get(e.id);
    if (!g) continue;
    if (g.from) {
      e.from = { ...(e.from ?? {}), x: g.from.x, y: g.from.y };
    }
    if (g.to) {
      e.to = { ...(e.to ?? {}), x: g.to.x, y: g.to.y };
    }
  }
}
