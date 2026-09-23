import { NextResponse } from "next/server";
import { healthQuoteProvider } from "@/lib/services/health-quote-provider";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "invalid_request", message: "Invalid request body." } }, { status: 400 });
  }

  const zip = (body as { zip?: unknown })?.zip;
  if (typeof zip !== "string" || !zip) {
    return NextResponse.json({ ok: false, error: { code: "invalid_request", message: "A ZIP code is required." } }, { status: 400 });
  }

  const result = await healthQuoteProvider.countiesByZip(zip);
  if (!result.ok) {
    const status = result.error.code === "invalid_zip" ? 400 : 502;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
