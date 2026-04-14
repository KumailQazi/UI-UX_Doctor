import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/env";
import { isAnthropicModel } from "@/lib/aiClient";
import { getModelForAgent } from "@/lib/modelRouter";
import type { PlanCode } from "@/lib/pricingConfig";

interface ModelSet {
  vision: string;
  fixDefault: string;
  fixEscalated: string;
  preference: string;
}

function getModelsByPlan(plan: PlanCode): ModelSet {
  return {
    vision: getModelForAgent("vision", plan),
    fixDefault: getModelForAgent("fix", plan, { severity: "low", confidence: 0.9 }),
    fixEscalated: getModelForAgent("fix", plan, { severity: "high", confidence: 0.4 }),
    preference: getModelForAgent("preference", plan),
  };
}

export async function GET() {
  const plans: PlanCode[] = ["free", "pro", "enterprise"];
  const modelsByPlan = Object.fromEntries(plans.map((plan) => [plan, getModelsByPlan(plan)])) as Record<
    PlanCode,
    ModelSet
  >;

  const allModels = plans.flatMap((plan) => {
    const models = modelsByPlan[plan];
    return [models.vision, models.fixDefault, models.fixEscalated, models.preference];
  });

  const needsAnthropic = allModels.some((model) => isAnthropicModel(model));
  const needsOpenAI = allModels.some((model) => !isAnthropicModel(model));

  const openaiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
  const anthropicReady = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  const missingProviders: string[] = [];
  if (needsOpenAI && !openaiReady) {
    missingProviders.push("openai");
  }
  if (needsAnthropic && !anthropicReady) {
    missingProviders.push("anthropic");
  }

  const ready = !DEMO_MODE && missingProviders.length === 0;

  return NextResponse.json(
    {
      ready,
      demoMode: DEMO_MODE,
      missingProviders,
      providerStatus: {
        openai: { required: needsOpenAI, ready: openaiReady },
        anthropic: { required: needsAnthropic, ready: anthropicReady },
      },
      modelsByPlan,
    },
    { status: ready ? 200 : 503 }
  );
}
