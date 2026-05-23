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
  const prevLine = prev
    ? `- JUST BEFORE this frame (t=${prev.start.toFixed(1)}s): ${describeEvent(prev, focusName, opponentName)}`
    : "- This is the first event of the play.";
  const nextLine = next
    ? `- WHAT HAPPENS NEXT (t=${next.start.toFixed(1)}s): ${describeEvent(next, focusName, opponentName)} — let the overlay foreshadow this destination if it makes the play readable (e.g. softer secondary arrow toward the next receiver).`
    : "- This is the last event of the play.";

  return `You are a TV tactical analyst drawing live overlays on a football broadcast frame.

MATCH
- ${focusName} (focus, in possession) vs ${opponentName}.
- Focus color: ${focusColor}. Defender color: ${defenderColor}.
- Phase: ${analysis.phase}. Attacking direction is left to right.
- ${outcomeLine(analysis, focusName, opponentName)}

FULL TIMELINE OF THIS PLAY
${timeline(analysis, focusName, opponentName)}

THIS FRAME (t=${e.start.toFixed(1)}s)
- CURRENT EVENT: ${describeEvent(e, focusName, opponentName)}
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
  const prevLine = prev
    ? `- PREVIOUS event (t=${prev.start.toFixed(1)}s): ${describeEvent(prev, focusName, opponentName)} — players should already be in positions consistent with what just happened.`
    : "- This is the FIRST event of the play.";
  const nextLine = next
    ? `- NEXT event (t=${next.start.toFixed(1)}s): ${describeEvent(next, focusName, opponentName)} — off-ball players should already be SHIFTING toward where this next event will happen (e.g. a runner sprinting into the gap, defenders rotating to cover, the eventual receiver already moving toward the next ball arrival point).`
    : "- This is the LAST event of the play.";

  return `You are generating a TOP-DOWN tactical diagram of a single moment in a football play.

OUTPUT a brand-new image (do NOT edit the input). Use the input only as a positional reference.

MATCH CONTEXT
- ${focusName} (focus) vs ${opponentName}. ${focusName} attacks left to right.
- ${outcomeLine(analysis, focusName, opponentName)}

FULL TIMELINE OF THIS PLAY (use this to predict positioning consistent with the whole sequence)
${timeline(analysis, focusName, opponentName)}

REQUIRED IMAGE
- A full horizontal football pitch on green grass with crisp white lines: halfway line, center circle, both penalty boxes, both six-yard boxes, both goals, corner arcs. The diagram fills the entire image.
- Bird's-eye view. Attacking direction LEFT to RIGHT.
- Players are small filled circles with a 2px black outline. Inside each circle place the shirt number in bold black text (or blank if number unknown).
  - ${focusName} circles are CYAN (${FOCUS_COLOR}).
  - ${opponentName} circles are SOFT RED (${OPPONENT_COLOR}).
- The ball is a small white dot with a thin black outline.

SCENE TO DEPICT (this exact frame, t = ${e.start.toFixed(1)}s)
- CURRENT EVENT: ${describeEvent(e, focusName, opponentName)}
- Place ${describePlayer(e.from)} approximately where this event STARTS.
- Place ${describePlayer(e.to)} approximately where this event ENDS.
- Draw the CURRENT event as an arrow: ${e.type === "pass" || e.type === "cross" || e.type === "switch" ? "solid cyan arrow representing the pass trajectory" : e.type === "run" || e.type === "carry" || e.type === "dribble" ? "dashed cyan arrow representing the run/carry" : e.type === "shot" ? "bold cyan arrow ending at the goal" : e.type === "press" || e.type === "tackle" ? "thin red-orange arrow showing the press" : "cyan arrow"}.
${prevLine}
${nextLine}
- Add 6–10 OTHER visible players around the ball, including 2–4 defenders. Position them in shapes CONSISTENT with the full timeline above: focus team in a shape that is mid-motion of this attacking sequence; defending team reacting/collapsing toward where the play is going.
- ${rosterStr(focusRoster, "Focus roster hints")}.
- ${rosterStr(oppRoster, "Opponent roster hints")}.

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
