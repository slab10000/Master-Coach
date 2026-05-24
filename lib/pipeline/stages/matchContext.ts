import { emitStage } from "../events";
import { googleClient } from "@/lib/providers/google";
import { writeJson } from "@/lib/fs/analysis";
import type { MatchHint, MatchFacts } from "@/lib/types";
import { Type } from "@google/genai";

const MATCH_FACTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    competition: { type: Type.STRING },
    stage: { type: Type.STRING },
    date: { type: Type.STRING },
    venue: { type: Type.STRING },
    teams: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          formation: { type: Type.STRING },
          players: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.NUMBER },
                name: { type: Type.STRING },
                position: { type: Type.STRING },
                started: { type: Type.BOOLEAN },
              },
              required: ["number", "name", "position", "started"],
            },
          },
        },
        required: ["name", "players"],
      },
    },
    goals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          team: { type: Type.STRING },
          player: { type: Type.STRING },
          minute: { type: Type.STRING },
          type: { type: Type.STRING },
        },
        required: ["team", "player", "minute"],
      },
    },
    notes: { type: Type.ARRAY, items: { type: Type.STRING } },
    source_confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
    missing_information: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["competition", "teams", "goals", "notes", "source_confidence", "missing_information"],
};

export async function matchContext(clipId: string, hint: MatchHint | undefined): Promise<MatchFacts> {
  emitStage(clipId, "matchContext", "started", "Searching the web for match facts");
  const ai = googleClient();
  const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

  const hintText = hint
    ? `Competition: ${hint.competition ?? "?"}\nMatch: ${hint.match ?? "?"}\nYear/Season: ${hint.season ?? "?"}\nDate: ${hint.date ?? "?"}\nMinute: ${hint.minute ?? "?"}\nTeam focus: ${hint.team_focus ?? "?"}\nEvent: ${hint.event ?? "?"}`
    : "No hint provided.";

  let searchSnippets = "";
  try {
    const grounded = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Use Google Search to find verified facts about this football match. Return raw notes you find — teams, lineups (with shirt numbers if available), goals with minutes, formations, venue, date, stage, key substitutions.\n\nHint:\n${hintText}`,
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    });
    searchSnippets = grounded.text ?? "";
    emitStage(
      clipId,
      "matchContext",
      "done",
      `Gathered web context (${searchSnippets.length} chars)`,
    );
  } catch (err) {
    console.error("grounded search failed", err);
    emitStage(clipId, "matchContext", "done", "Search unavailable, using hint only");
  }

  emitStage(clipId, "matchFacts", "started", "Structuring match facts");
  const structured = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a football match researcher. Convert web research and the user hint into verified structured match facts. Do not invent missing facts; mark uncertainty. Use empty arrays and lower source_confidence when in doubt.

USER HINT:
${hintText}

WEB RESEARCH NOTES:
${searchSnippets || "(none)"}

Output JSON matching the provided schema.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: MATCH_FACTS_SCHEMA,
      temperature: 0.1,
    },
  });

  let facts: MatchFacts;
  try {
    facts = JSON.parse(structured.text ?? "{}");
  } catch {
    facts = {
      competition: hint?.competition ?? "Unknown",
      teams: [],
      goals: [],
      notes: ["Failed to parse structured output"],
      source_confidence: "low",
      missing_information: ["all"],
    };
  }
  await writeJson(clipId, "match_context.json", facts);
  emitStage(clipId, "matchFacts", "done", `Built facts (${facts.source_confidence} confidence)`);
  return facts;
}
