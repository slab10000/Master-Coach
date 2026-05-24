import { promises as fs } from "node:fs";
import path from "node:path";
import { googleClient } from "@/lib/providers/google";
import { imageMimeType } from "@/lib/providers/imageMime";
import { emitStage } from "../events";
import { analysisDir } from "@/lib/fs/analysis";
import type { TacticalAnalysis } from "@/lib/types";
import type { MinimapFrame } from "./topdownMinimaps";

function describePlayer(p?: { number?: number; name?: string; role?: string }): string {
  if (!p) return "ball carrier";
  const bits: string[] = [];
  if (p.number != null) bits.push(`#${p.number}`);
  if (p.name) bits.push(p.name);
  if (p.role) bits.push(`(${p.role})`);
  return bits.length ? bits.join(" ") : "unidentified player";
}

function timelineString(analysis: TacticalAnalysis, focusName: string, opponentName: string): string {
  return [...(analysis.events ?? [])]
    .sort((a, b) => a.start - b.start)
    .map(
      (ev) =>
        `  t=${ev.start.toFixed(1)}s–${ev.end.toFixed(1)}s [${ev.type}] ${ev.team === "focus" ? focusName : opponentName} ${describePlayer(ev.from)} → ${describePlayer(ev.to)}. ${ev.description}${ev.tactical_effect ? ` (${ev.tactical_effect})` : ""}`,
    )
    .join("\n");
}

function extractSvg(text: string): string | null {
  // Strip ```svg ... ``` fences if present.
  const fenced = text.match(/```(?:svg|xml)?\s*([\s\S]*?)\s*```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("<svg");
  const endTag = "</svg>";
  const endIdx = body.lastIndexOf(endTag);
  if (start === -1 || endIdx === -1) return null;
  return body.slice(start, endIdx + endTag.length).trim();
}

export async function cinematicSvg(
  clipId: string,
  analysis: TacticalAnalysis,
  minimaps: MinimapFrame[],
): Promise<string | null> {
  emitStage(clipId, "cinematicSvg", "started", "Generating cinematic SVG replay");
  const ai = googleClient();
  const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

  const focusName = analysis.team_focus;
  const opponentName =
    analysis.team_focus === analysis.attacking_team
      ? analysis.defending_team
      : analysis.attacking_team;
  const totalDuration = Math.max(
    ...((analysis.events ?? []).map((e) => e.end) || [1]),
    1,
  );

  const sample = minimaps.find((m) => m.minimapPath) ?? minimaps[0];
  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
  if (sample?.minimapPath) {
    try {
      const buf = await fs.readFile(sample.minimapPath);
      imageParts.push({
        inlineData: {
          mimeType: imageMimeType(sample.minimapPath),
          data: buf.toString("base64"),
        },
      });
    } catch {
      // ignore — we'll proceed without the visual reference
    }
  }

  const prompt = `You are a sports motion-graphics designer. Generate ONE animated SVG that visualizes this entire football play as a polished tactical replay on a top-down pitch.

MATCH
- ${focusName} attacks LEFT → RIGHT.
- ${opponentName} defends the RIGHT goal.
- Final outcome: ${analysis.outcome.type.toUpperCase()} for ${analysis.outcome.for_focus_team ? focusName : opponentName} (quality: ${analysis.outcome.quality}).
- Summary: ${analysis.summary}

TIMELINE (use these timings; the SVG animation should run from 0s to ${totalDuration.toFixed(1)}s)
${timelineString(analysis, focusName, opponentName)}

KEY MOMENTS
${(analysis.key_moments ?? []).map((k) => `  t=${k.timestamp.toFixed(1)}s: ${k.label} — ${k.why_it_matters}`).join("\n")}

OUTPUT REQUIREMENTS (strict)
- Return ONLY a single, valid, self-contained <svg> element. No prose, no markdown fences, no <html>.
- viewBox="0 0 100 68". Use this normalized pitch coordinate system.
- Background: a horizontal football pitch on green grass with white lines (halfway line, center circle, both penalty boxes, both six-yard boxes, both goals at the LEFT and RIGHT edges, corner arcs).
- Draw circles for every player involved in the timeline:
  - ${focusName} = filled cyan (#4DD8FF) with 2px dark grey outline.
  - ${opponentName} = filled soft red (#FF4D3D) with 2px dark grey outline.
  - Each circle has the player's shirt number inside in bold white text.
- Draw the ball as a white circle with a thin dark outline.
- Use SVG SMIL animation (<animate>, <animateMotion>, <animateTransform>) to:
  - Move each involved player along realistic paths over time matching the timeline.
  - Move the ball through each event from→to, in order, using each event's start/end timestamps.
  - For each pass/run/carry/shot, draw the corresponding arrow with a draw-on effect synced to the event window. Pass arrows are SOLID cyan; runs are DASHED cyan; shots are BOLD cyan ending at the right goal; defending team actions are red.
  - Highlight space-created zones (translucent gold polygons) when a key moment about "space" or "gap" fires.
- All <animate> tags must use begin="0s" relative timings (begin="${"\${start}"}s" where start matches event timestamps in seconds).
- The animation must repeat indefinitely (use repeatCount="indefinite" with dur="${totalDuration.toFixed(1)}s" on a wrapping group or on each animation as appropriate).
- Use a subtle filter (id="glow") to give arrows a soft glow.
- ABSOLUTELY NO external CSS, NO <script>, NO <foreignObject>, NO data: URIs. Pure inline SVG only.
- Use crisp white pitch lines on a green pitch (linear gradient #0e4a36 → #0a3527 is good).
- Aim for under 200 elements total; this should be readable, not a wall of dots.

Return ONLY the <svg>…</svg> element.`;

  const contents: any[] = [{ text: prompt }];
  if (imageParts.length) contents.push(...imageParts);

  const result = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: contents }],
    config: { temperature: 0.5 },
  });

  const raw = result.text ?? "";
  const svg = extractSvg(raw);
  if (!svg) {
    emitStage(clipId, "cinematicSvg", "error", "Model did not return a valid <svg>");
    return null;
  }

  const outPath = path.join(analysisDir(clipId), "cinematic.svg");
  await fs.writeFile(outPath, svg, "utf-8");
  emitStage(
    clipId,
    "cinematicSvg",
    "done",
    `Cinematic SVG written (${(svg.length / 1024).toFixed(1)} KB)`,
  );
  return svg;
}
