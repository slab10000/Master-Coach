import { promises as fs } from "node:fs";
import { Type } from "@google/genai";
import { googleClient } from "@/lib/providers/google";
import { emitStage } from "../events";
import { writeJson } from "@/lib/fs/analysis";
import type { MatchFacts, MatchHint, TacticalAnalysis } from "@/lib/types";

const TACTICAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clip_id: { type: Type.STRING },
    summary: { type: Type.STRING },
    phase: { type: Type.STRING },
    team_focus: { type: Type.STRING },
    attacking_team: { type: Type.STRING },
    defending_team: { type: Type.STRING },
    outcome: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING },
        for_focus_team: { type: Type.BOOLEAN },
        quality: { type: Type.STRING, enum: ["low", "medium", "high"] },
      },
      required: ["type", "for_focus_team", "quality"],
    },
    events: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
          type: {
            type: Type.STRING,
            enum: ["pass", "run", "shot", "press", "carry", "tackle", "cross", "dribble", "switch"],
          },
          team: { type: Type.STRING, enum: ["focus", "opponent"] },
          from: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.NUMBER },
              name: { type: Type.STRING },
              role: { type: Type.STRING },
            },
          },
          to: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.NUMBER },
              name: { type: Type.STRING },
              role: { type: Type.STRING },
            },
          },
          description: { type: Type.STRING },
          tactical_effect: { type: Type.STRING },
        },
        required: ["id", "start", "end", "type", "team", "description"],
      },
    },
    key_moments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.NUMBER },
          label: { type: Type.STRING },
          why_it_matters: { type: Type.STRING },
        },
        required: ["timestamp", "label", "why_it_matters"],
      },
    },
    coaching_points: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: {
      type: Type.OBJECT,
      properties: {
        player_identity: { type: Type.STRING, enum: ["low", "medium", "high"] },
        ball_tracking: { type: Type.STRING, enum: ["low", "medium", "high"] },
        tactical_interpretation: { type: Type.STRING, enum: ["low", "medium", "high"] },
      },
      required: ["player_identity", "ball_tracking", "tactical_interpretation"],
    },
  },
  required: [
    "clip_id",
    "summary",
    "phase",
    "team_focus",
    "attacking_team",
    "defending_team",
    "outcome",
    "events",
    "key_moments",
    "coaching_points",
    "confidence",
  ],
};

export async function geminiTactical(
  clipId: string,
  clipPath: string,
  facts: MatchFacts,
  hint: MatchHint | undefined,
): Promise<TacticalAnalysis> {
  emitStage(clipId, "geminiTactical", "started", "Uploading clip to Gemini");
  const ai = googleClient();
  const model = process.env.GEMINI_VIDEO_MODEL ?? "gemini-2.5-flash";

  let videoPart: { fileData?: { fileUri: string; mimeType: string }; inlineData?: { data: string; mimeType: string } };
  try {
    const uploaded = await ai.files.upload({
      file: clipPath,
      config: { mimeType: "video/mp4" },
    });
    // wait for processing
    let info = uploaded;
    for (let i = 0; i < 30 && info.state === "PROCESSING"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      info = await ai.files.get({ name: info.name! });
    }
    if (info.state !== "ACTIVE") throw new Error(`File state ${info.state}`);
    videoPart = { fileData: { fileUri: info.uri!, mimeType: info.mimeType ?? "video/mp4" } };
    emitStage(clipId, "geminiTactical", "progress", "Clip ready, analyzing");
  } catch (err) {
    console.warn("File upload failed, falling back to inline base64", err);
    const buf = await fs.readFile(clipPath);
    videoPart = { inlineData: { data: buf.toString("base64"), mimeType: "video/mp4" } };
  }

  const focusTeam = hint?.team_focus ?? facts.teams[0]?.name ?? "Unknown";
  const factsText = JSON.stringify(facts, null, 2);

  const prompt = `You are an elite football tactical analyst. Watch the clip and explain the play in coach language. Prioritize tactical causality: what action created what advantage.

FOCUS TEAM: ${focusTeam}
${hint?.event ? `EVENT HINT: ${hint.event}` : ""}
${hint?.play_was_for_focus_team !== undefined ? `PLAY DIRECTION: ${hint.play_was_for_focus_team ? "for focus team" : "against focus team"}` : ""}

MATCH FACTS:
${factsText}

Answer in the structured schema. Use clip_id="${clipId}".

Focus on NARRATIVE only — describe events, players, timings. DO NOT include pitch coordinates; a separate geometry pass will assign positions from a top-down view.

For every pass/run/shot event:
- Provide start and end timestamps in seconds (within the clip).
- Use role like "RW", "LCM", "RB", or "CF" plus shirt number if visible. If identity is unclear, omit name.
- Provide a one-sentence tactical_effect explaining what changed because of the event.

key_moments are the 2–4 most important inflection points: line broken, space opened, decision point, finish.
coaching_points are 2–4 short actionable bullets.

Be precise about timings; the UI uses them to synchronize a tactical board.`;

  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, videoPart as any],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: TACTICAL_SCHEMA,
      temperature: 0.3,
    },
  });

  const analysis = JSON.parse(result.text ?? "{}") as TacticalAnalysis;
  analysis.clip_id = clipId;
  await writeJson(clipId, "tactical_analysis.json", analysis);
  emitStage(clipId, "geminiTactical", "done", `Found ${analysis.events?.length ?? 0} events`);
  return analysis;
}
