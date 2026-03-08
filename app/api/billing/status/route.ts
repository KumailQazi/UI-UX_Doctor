import { NextResponse } from "next/server";
import { getBillingStatus } from "@/lib/billing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "demo-project";

  try {
    const status = await getBillingStatus(projectId);
    return NextResponse.json(
      {
        projectId,
        ...status,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load billing status" },
      { status: 500 }
    );
  }
}
