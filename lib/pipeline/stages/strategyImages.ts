import path from "node:path";
import { promises as fs } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import pLimit from "p-limit";
import { Modality } from "@google/genai";
import { emitStage } from "../events";
import { writeJson } from "@/lib/fs/analysis";
import { googleClient } from "@/lib/providers/google";
import { imageMimeType } from "@/lib/providers/imageMime";
import type { HeroFrame, TacticalAnalysis, TacticalEvent } from "@/lib/types";
import type { HeroCandidate } from "./selectHeroFrames";
import type { MinimapFrame } from "./topdownMinimaps";

const execAsync = promisify(exec);

const FOCUS_COLOR = "#4DD8FF"; // cyan
const OPPONENT_COLOR = "#FF4D3D"; // red-orange
const COACH_FIX_COLOR = "#8B5CF6"; // violet

/** Where the debug-friendly outputs live: <repo>/clips/strategy_images/<clipId>/ */
function strategyImagesDir(clipId: string): string {
  return path.join(process.cwd(), "clips", "strategy_images", clipId);
}

async function convertToWebp(sourcePath: string, outPath: string): Promise<void> {
  if (sourcePath.toLowerCase().endsWith(".webp")) {
    await fs.copyFile(sourcePath, outPath);
    return;
  }
  await execAsync(`cwebp -quiet -q 82 "${sourcePath}" -o "${outPath}"`);
}

async function callNanoBanana(
  prompt: string,
  framePath: string,
  outPath: string,
): Promise<{ ok: boolean; reason?: string }> {
  const ai = googleClient();
  const model = process.env.GEMINI_IMAGE_EDIT_MODEL ?? "gemini-3.1-flash-image-preview";
  const img = await fs.readFile(framePath);
  try {
    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
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
        const ext = inline.mimeType?.includes("png")
          ? ".png"
          : inline.mimeType?.includes("webp")
            ? ".webp"
            : ".jpg";
        const tmp = `${outPath}.source${ext}`;
        await fs.writeFile(tmp, Buffer.from(inline.data, "base64"));
        try {
          await convertToWebp(tmp, outPath);
        } finally {
          await fs.rm(tmp, { force: true });
        }
        return { ok: true };
      }
      const t = (part as { text?: string }).text;
      if (t) textBack += t;
    }
    return {
      ok: false,
      reason: textBack ? `text-only: ${textBack.slice(0, 140)}` : "no inline image",
    };
  } catch (err) {
    return { ok: false, reason: String((err as Error)?.message ?? err) };
  }
}

function describePlayer(p: TacticalEvent["from"]): string {
  if (!p) return "the ball carrier";
  const bits: string[] = [];
  if (p.number != null) bits.push(`#${p.number}`);
  if (p.name) bits.push(p.name);
  if (p.role) bits.push(`(${p.role})`);
  return bits.length ? bits.join(" ") : "an unidentified player";
}

function describeEvent(e: TacticalEvent, focusName: string, opponentName: string): string {
  const team = e.team === "focus" ? focusName : opponentName;
  return `[${e.type.toUpperCase()}] by ${team}: ${describePlayer(e.from)} → ${describePlayer(e.to)}. ${e.description}${e.tactical_effect ? ` Tactical effect: ${e.tactical_effect}` : ""}`;
}

function timeline(analysis: TacticalAnalysis, focusName: string, opponentName: string): string {
  const sorted = [...(analysis.events ?? [])].sort((a, b) => a.start - b.start);
  return sorted
    .map(
      (ev) =>
        `  t=${ev.start.toFixed(1)}s [${ev.type}] ${ev.team === "focus" ? focusName : opponentName} ${describePlayer(ev.from)} → ${describePlayer(ev.to)}`,
    )
    .join("\n");
}

function neighbours(
  c: HeroCandidate,
  analysis: TacticalAnalysis,
): { prev?: TacticalEvent; next?: TacticalEvent } {
  const sorted = [...(analysis.events ?? [])].sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex((e) => e.id === c.event.id);
  return { prev: idx > 0 ? sorted[idx - 1] : undefined, next: idx >= 0 ? sorted[idx + 1] : undefined };
}

function outcomeLine(analysis: TacticalAnalysis, focusName: string, opponentName: string): string {
  const o = analysis.outcome;
  const winner = o.for_focus_team ? focusName : opponentName;
  return `Final outcome of the play: ${o.type.toUpperCase()} for ${winner} (quality: ${o.quality}). ${analysis.summary}`;
}

// Anchor every image in the same orientation so the AI does not flip the pitch between frames.
// Convention: focus team ALWAYS attacks the RIGHT goal. Opponent ALWAYS defends the RIGHT goal.
function orientationBlock(focusName: string, opponentName: string): string {
  return `PITCH ORIENTATION (this is fixed across ALL frames of this play — do NOT flip it)
- The pitch is horizontal. Left edge = goal line of ${focusName}'s OWN goal (the goal ${focusName} is DEFENDING).
- Right edge = goal line of ${opponentName}'s goal (the goal ${focusName} is ATTACKING).
- ${focusName} attacks LEFT → RIGHT. ${opponentName} attacks RIGHT → LEFT.
- "Forward" for ${focusName} means moving toward the RIGHT side of the image.
- The ${focusName} goalkeeper stands on the LEFT. The ${opponentName} goalkeeper stands on the RIGHT.`;
}

// Coarse top-down pitch zone for an event — derived from role + sequence position so it stays
// consistent with the heuristic geometry the strategy board will end up using.
function zoneHint(e: TacticalEvent, eventIndex: number, totalEvents: number): string {
  const role = (e.from?.role ?? e.to?.role ?? "").toUpperCase();
  // Default: progress along the pitch by sequence index (0..1 → x in 25..90).
  const t = totalEvents > 1 ? eventIndex / (totalEvents - 1) : 0.5;
  let xZone: string;
  let yZone: string;

  // Role-driven baseline (overrides progress for clearly positional roles).
  if (/GK/.test(role)) xZone = "own goal area (far LEFT of pitch)";
  else if (/CB|RCB|LCB|DEF/.test(role)) xZone = "own defensive third (LEFT third)";
  else if (/DM|CDM/.test(role)) xZone = "deep midfield (just past own half, slight LEFT of center)";
  else if (/CM|LCM|RCM|MID/.test(role)) xZone = "central midfield (around the halfway line)";
  else if (/AM|CAM|10/.test(role)) xZone = "attacking midfield (entering opposition half, right-center)";
  else if (/CF|ST|9/.test(role) && e.type === "shot") xZone = "OPPOSITION penalty area (FAR RIGHT, in front of opponent goal)";
  else if (/CF|ST|9/.test(role)) xZone = "opposition third, central (RIGHT third)";
  else if (/RW|RF/.test(role)) xZone = "opposition third, RIGHT flank (top of pitch from this view)";
  else if (/LW|LF/.test(role)) xZone = "opposition third, LEFT flank (bottom of pitch from this view)";
  else if (/RB|RWB/.test(role)) xZone = "right flank, own half side";
  else if (/LB|LWB/.test(role)) xZone = "left flank, own half side";
  else {
    // Sequence-based fallback.
    if (t < 0.2) xZone = "own half (LEFT side of the pitch)";
    else if (t < 0.5) xZone = "midfield (around the center)";
    else if (t < 0.85) xZone = "opposition half (RIGHT side of the pitch)";
    else xZone = "opposition penalty area (FAR RIGHT, near the attacking goal)";
  }

  // Lateral hint (y) — try to derive from role.
  if (/RW|RF|RB|RWB|RCM|RM|RCB/.test(role)) yZone = "right flank (top side of the image)";
  else if (/LW|LF|LB|LWB|LCM|LM|LCB/.test(role)) yZone = "left flank (bottom side of the image)";
  else yZone = "central corridor (vertical middle of the pitch)";

  // Opponent events mirror — they're attacking the other way.
  if (e.team === "opponent") {
    const mirror = xZone
      .replace(/LEFT/g, "<<L>>")
      .replace(/RIGHT/g, "LEFT")
      .replace(/<<L>>/g, "RIGHT");
    return `${mirror}; ${yZone}`;
  }
  return `${xZone}; ${yZone}`;
}

function broadcastPrompt(
  c: HeroCandidate,
  analysis: TacticalAnalysis,
  focusName: string,
  opponentName: string,
): string {
  const e = c.event;
  const focusColor = e.team === "focus" ? FOCUS_COLOR : OPPONENT_COLOR;
  const defenderColor = e.team === "focus" ? OPPONENT_COLOR : FOCUS_COLOR;

  let actionLine = "";
  switch (e.type) {
    case "pass":
    case "cross":
    case "switch":
      actionLine = `Draw a bold ${focusColor} curved arrow with a soft glowing halo from the passer (${describePlayer(e.from)}) to the receiver (${describePlayer(e.to)}). The arrow must follow a realistic ball-flight curve.`;
      break;
    case "shot":
      actionLine = `Draw a bold ${focusColor} arrow with a glowing halo from the shooter (${describePlayer(e.from)}) toward the goal. Add a small crosshair marker at the target.`;
      break;
    case "run":
    case "carry":
    case "dribble":
      actionLine = `Draw a dashed ${focusColor} arrow showing the run/carry of ${describePlayer(e.from)} along the path they take in the clip.`;
      break;
    case "press":
    case "tackle":
      actionLine = `Draw a thin red-orange pressing line from the defender (${describePlayer(e.from)}) toward the ball carrier. Add a small impact burst at the end if it is a tackle.`;
      break;
    default:
      actionLine = `Draw a ${focusColor} arrow representing the event from ${describePlayer(e.from)} to ${describePlayer(e.to)}.`;
  }

  const { prev, next } = neighbours(c, analysis);
  const sorted = [...(analysis.events ?? [])].sort((a, b) => a.start - b.start);
  const evIdx = sorted.findIndex((ev) => ev.id === e.id);
  const total = sorted.length;
  const currentZone = zoneHint(e, evIdx, total);
  const prevLine = prev
    ? `- JUST BEFORE this frame (t=${prev.start.toFixed(1)}s, zone: ${zoneHint(prev, evIdx - 1, total)}): ${describeEvent(prev, focusName, opponentName)}`
    : "- This is the first event of the play.";
  const nextLine = next
    ? `- WHAT HAPPENS NEXT (t=${next.start.toFixed(1)}s, zone: ${zoneHint(next, evIdx + 1, total)}): ${describeEvent(next, focusName, opponentName)} — let the overlay foreshadow this destination if it makes the play readable (e.g. softer secondary arrow toward the next receiver).`
    : "- This is the last event of the play.";

  return `You are a TV tactical analyst drawing live overlays on a football broadcast frame.

MATCH
- ${focusName} (focus, in possession) vs ${opponentName}.
- Focus color: ${focusColor}. Defender color: ${defenderColor}.
- Phase: ${analysis.phase}.
- ${outcomeLine(analysis, focusName, opponentName)}

${orientationBlock(focusName, opponentName)}

FULL TIMELINE OF THIS PLAY
${timeline(analysis, focusName, opponentName)}

THIS FRAME (t=${e.start.toFixed(1)}s)
- CURRENT EVENT: ${describeEvent(e, focusName, opponentName)}
- BALL/PLAY ZONE right now: ${currentZone}.
${prevLine}
${nextLine}

TASK
${actionLine}

ALSO add ONE of the following if it helps explain the play:
- A short red-orange dashed arrow on the 1–2 NEAREST defenders to show their reactive movement (tracking, shifting toward where the ball is going next).
- A translucent gold (15% opacity) zone behind the defensive line if space has opened — place it where the NEXT action will exploit it.
- A small pulsing dot at the key decision point.

HARD RULES
- Preserve every original pixel outside the overlay. Do NOT alter player faces, jerseys, the crowd, the pitch grass, or scoreboard.
- Arrows are bold with a soft outer halo; lines are crisp, not painterly.
- NO text labels in the image. NO logos. NO captions.
- Return ONLY the edited broadcast image.`;
}

function topdownPrompt(
  c: HeroCandidate,
  analysis: TacticalAnalysis,
  focusName: string,
  opponentName: string,
): string {
  const e = c.event;
  // Roster of likely-on-pitch players (best-effort from prior events in the analysis).
  const peopleSeen = new Map<string, { team: "focus" | "opponent"; number?: number; role?: string; name?: string }>();
  for (const ev of analysis.events ?? []) {
    for (const side of ["from", "to"] as const) {
      const p = ev[side];
      if (!p) continue;
      const key = `${ev.team}-${p.number ?? p.role ?? p.name}`;
      if (!peopleSeen.has(key)) {
        peopleSeen.set(key, { team: ev.team, number: p.number, role: p.role, name: p.name });
      }
    }
  }
  const focusRoster = Array.from(peopleSeen.values()).filter((p) => p.team === "focus");
  const oppRoster = Array.from(peopleSeen.values()).filter((p) => p.team === "opponent");
  const rosterStr = (list: typeof focusRoster, label: string) =>
    list.length
      ? `${label}: ${list.map((p) => `#${p.number ?? "?"} ${p.role ?? ""}`.trim()).join(", ")}`
      : `${label}: not identified`;

  const { prev, next } = neighbours(c, analysis);
  const sorted = [...(analysis.events ?? [])].sort((a, b) => a.start - b.start);
  const evIdx = sorted.findIndex((ev) => ev.id === e.id);
  const total = sorted.length;
  const currentZone = zoneHint(e, evIdx, total);
  const prevLine = prev
    ? `- PREVIOUS event (t=${prev.start.toFixed(1)}s, was in: ${zoneHint(prev, evIdx - 1, total)}): ${describeEvent(prev, focusName, opponentName)} — players should already be in positions consistent with what just happened.`
    : "- This is the FIRST event of the play.";
  const nextLine = next
    ? `- NEXT event (t=${next.start.toFixed(1)}s, will happen in: ${zoneHint(next, evIdx + 1, total)}): ${describeEvent(next, focusName, opponentName)} — off-ball players should already be SHIFTING toward where this next event will happen (e.g. a runner sprinting into the gap, defenders rotating to cover, the eventual receiver already moving toward the next ball arrival point).`
    : "- This is the LAST event of the play.";

  return `You are generating a TOP-DOWN tactical diagram of a single moment in a football play.

OUTPUT a brand-new image (do NOT edit the input). Use the input only as a positional reference.

MATCH CONTEXT
- ${focusName} (focus) vs ${opponentName}.
- ${outcomeLine(analysis, focusName, opponentName)}

${orientationBlock(focusName, opponentName)}

FULL TIMELINE OF THIS PLAY (use this to predict positioning consistent with the whole sequence)
${timeline(analysis, focusName, opponentName)}

REQUIRED IMAGE
- A full horizontal football pitch on green grass with crisp white lines: halfway line, center circle, both penalty boxes, both six-yard boxes, both goals, corner arcs. The diagram fills the entire image.
- Bird's-eye view. ${focusName} ATTACKS THE RIGHT GOAL (left → right).
- Draw BOTH goals visible in the image, on the LEFT and RIGHT edges.
- Players are small filled circles with a 2px black outline. Inside each circle place the shirt number in bold black text (or blank if number unknown).
  - ${focusName} circles are CYAN (${FOCUS_COLOR}).
  - ${opponentName} circles are SOFT RED (${OPPONENT_COLOR}).
- The ball is a small white dot with a thin black outline.

SCENE TO DEPICT (this exact frame, t = ${e.start.toFixed(1)}s)
- CURRENT EVENT: ${describeEvent(e, focusName, opponentName)}
- BALL/PLAY ZONE right now: ${currentZone}.
- Place ${describePlayer(e.from)} in that zone (where the event STARTS).
- Place ${describePlayer(e.to)} where this event ENDS (likely a step further toward the RIGHT goal for a focus-team forward action).
- Draw the CURRENT event as an arrow: ${e.type === "pass" || e.type === "cross" || e.type === "switch" ? "solid cyan arrow representing the pass trajectory" : e.type === "run" || e.type === "carry" || e.type === "dribble" ? "dashed cyan arrow representing the run/carry" : e.type === "shot" ? "bold cyan arrow ending at the RIGHT goal" : e.type === "press" || e.type === "tackle" ? "thin red-orange arrow showing the press" : "cyan arrow"}.
${prevLine}
${nextLine}
- Place the ${focusName} GOALKEEPER as a single cyan circle on the LEFT goal line.
- Place the ${opponentName} GOALKEEPER as a single red circle on the RIGHT goal line.
- Add 6–10 OTHER visible players around the ball, including 2–4 defenders. Position them in shapes CONSISTENT with the full timeline above and with the current play zone: focus team in mid-attack shape biased toward the RIGHT half; defending team retreating/collapsing toward the RIGHT goal they are defending.
- ${rosterStr(focusRoster, "Focus roster hints")}.
- ${rosterStr(oppRoster, "Opponent roster hints")}.

CROSS-FRAME CONSISTENCY (critical)
- Every frame of this play uses the SAME orientation: ${focusName} attacks the RIGHT goal. Do NOT flip the pitch between frames.
- A given player keeps the SAME jersey color across all frames (focus = cyan, opponent = red).
- The ball progresses through the zones in the order listed in the timeline above. Earlier events (lower t) are in zones to the LEFT; later events progress toward the RIGHT.

STRICT
- NO crowd, NO scoreboard, NO broadcast graphics, NO faces.
- NO text labels other than shirt numbers inside circles.
- NO photographic players — circles only.
- The pitch must be flat top-down, not 3D perspective.
- Output ONLY the diagram image.`;
}

export interface StrategyImageResult {
  heroFrames: HeroFrame[];
  topdownMinimaps: MinimapFrame[];
}

export async function strategyImages(
  clipId: string,
  candidates: HeroCandidate[],
  analysis: TacticalAnalysis,
): Promise<StrategyImageResult> {
  const total = candidates.length * 2;
  emitStage(
    clipId,
    "strategyImages",
    "started",
    `Rendering ${candidates.length} broadcast overlays + ${candidates.length} top-down schemas (${total} parallel calls)`,
  );

  const outDir = strategyImagesDir(clipId);
  await fs.mkdir(outDir, { recursive: true });

  const focusName = analysis.team_focus;
  const opponentName =
    analysis.team_focus === analysis.attacking_team
      ? analysis.defending_team
      : analysis.attacking_team;

  // Fire ALL calls (broadcast + topdown for every hero frame) in parallel.
  const limit = pLimit(total || 1);
  let done = 0;
  const failures: string[] = [];

  const tasks = candidates.flatMap((c) => {
    const broadcastOut = path.join(outDir, `event_${c.event.id}.broadcast.webp`);
    const topdownOut = path.join(outDir, `event_${c.event.id}.topdown.webp`);
    return [
      limit(async () => {
        const { ok, reason } = await callNanoBanana(
          broadcastPrompt(c, analysis, focusName, opponentName),
          c.frame.framePath,
          broadcastOut,
        );
        done++;
        if (!ok) failures.push(`broadcast ${c.event.id}: ${reason}`);
        emitStage(clipId, "strategyImages", "progress", `Rendered ${done}/${total}`, {
          progress: done / total,
        });
        return { kind: "broadcast" as const, candidate: c, ok, outPath: broadcastOut };
      }),
      limit(async () => {
        const { ok, reason } = await callNanoBanana(
          topdownPrompt(c, analysis, focusName, opponentName),
          c.frame.framePath,
          topdownOut,
        );
        done++;
        if (!ok) failures.push(`topdown ${c.event.id}: ${reason}`);
        emitStage(clipId, "strategyImages", "progress", `Rendered ${done}/${total}`, {
          progress: done / total,
        });
        return { kind: "topdown" as const, candidate: c, ok, outPath: topdownOut };
      }),
    ];
  });

  const results = await Promise.all(tasks);

  const broadcastByEvent = new Map<string, { ok: boolean; outPath: string }>();
  const topdownByEvent = new Map<string, { ok: boolean; outPath: string }>();
  for (const r of results) {
    (r.kind === "broadcast" ? broadcastByEvent : topdownByEvent).set(r.candidate.event.id, {
      ok: r.ok,
      outPath: r.outPath,
    });
  }

  const heroFrames: HeroFrame[] = candidates
    .map((c) => {
      const broadcast = broadcastByEvent.get(c.event.id);
      const topdown = topdownByEvent.get(c.event.id);
      const baseName = path.basename(c.frame.framePath);
      return {
        eventId: c.event.id,
        framePath: `/api/files/${clipId}/frames/${baseName}`,
        annotatedPath: broadcast?.ok
          ? `/api/strategy-images/${clipId}/${path.basename(broadcast.outPath)}`
          : `/api/files/${clipId}/frames/${baseName}`,
        topdownPath: topdown?.ok
          ? `/api/strategy-images/${clipId}/${path.basename(topdown.outPath)}`
          : undefined,
        timestamp: c.event.start,
        caption: c.event.tactical_effect || c.event.description,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  await writeJson(clipId, "hero_frames.json", heroFrames);

  const topdownMinimaps: MinimapFrame[] = candidates
    .map((c) => {
      const td = topdownByEvent.get(c.event.id);
      return {
        timestamp: c.event.start,
        framePath: c.frame.framePath,
        minimapPath: td?.ok ? td.outPath : null,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  await writeJson(clipId, "minimaps.json", topdownMinimaps);

  if (failures.length) {
    console.warn("[strategyImages] failures:", failures);
    emitStage(
      clipId,
      "strategyImages",
      "progress",
      `${failures.length}/${total} image(s) failed`,
      { payload: { failures } },
    );
  }

  const okCount = total - failures.length;
  emitStage(
    clipId,
    "strategyImages",
    "done",
    `Rendered ${okCount}/${total} images → clips/strategy_images/${clipId}/`,
  );

  return { heroFrames, topdownMinimaps };
}
