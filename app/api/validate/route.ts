import { NextRequest, NextResponse } from "next/server";
import { validateFix } from "@/lib/agents/qualitySentinelAgent";
import type { Issue, GenerateFixResponse } from "@/lib/issueSchema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fix, issue, context } = body as {
      fix: GenerateFixResponse;
      issue: Issue;
      context?: Parameters<typeof validateFix>[2];
    };

    if (!fix || !issue) {
      return NextResponse.json(
        { error: "Missing fix or issue in request body" },
        { status: 400 }
      );
    }

    const report = await validateFix(fix, issue, context || {});

    return NextResponse.json(report, { status: report.passed ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: "Validation failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
