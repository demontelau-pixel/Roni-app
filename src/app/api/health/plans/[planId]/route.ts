import { NextResponse } from "next/server";
import { healthQuoteProvider } from "@/lib/services/health-quote-provider";
import { validateHealthSearchCriteria } from "@/lib/logic/validate-health-criteria";

interface RouteContext {
  params: Promise<{ planId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { planId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "invalid_request", message: "Invalid request body." } }, { status: 400 });
  }

  const validated = validateHealthSearchCriteria(body);
  if (!validated.ok) return NextResponse.json(validated, { status: 400 });

  const result = await healthQuoteProvider.planDetails(planId, validated.data);
  if (!result.ok) {
    const status = result.error.code === "no_plans" || result.error.code === "county_required" ? 200 : 502;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
