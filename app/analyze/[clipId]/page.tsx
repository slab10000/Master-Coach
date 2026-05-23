import { getClipById } from "@/lib/fs/clips";
import { readJson } from "@/lib/fs/analysis";
import { notFound } from "next/navigation";
import { AnalysisApp } from "@/components/analysis/AnalysisApp";
import type {
  Counterplay,
  HeroFrame,
  MatchFacts,
  StrategyScene,
  TacticalAnalysis,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyzePage({
  params,
  searchParams,
}: {
  params: Promise<{ clipId: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { clipId } = await params;
  const sp = await searchParams;
  const clip = await getClipById(clipId);
  if (!clip) notFound();

  const [strategyScene, tacticalAnalysis, counterplay, matchFacts, heroFrames] = await Promise.all([
    readJson<StrategyScene>(clipId, "strategy_scene.json"),
    readJson<TacticalAnalysis>(clipId, "tactical_analysis.json"),
    readJson<Counterplay>(clipId, "counterplay.json"),
    readJson<MatchFacts>(clipId, "match_context.json"),
    readJson<HeroFrame[]>(clipId, "hero_frames.json"),
  ]);

  return (
    <AnalysisApp
      clipId={clipId}
      autoRun={sp.run === "1" && !strategyScene}
      initial={{ strategyScene, tacticalAnalysis, counterplay, matchFacts, heroFrames }}
    />
  );
}
