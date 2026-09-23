import { NextResponse } from "next/server";
import { healthQuoteProvider } from "@/lib/services/health-quote-provider";

// This data changes at most once a year — safe to cache at the edge
// for a while, and it means we ask CMS for it far less often.
export const revalidate = 3600;

export async function GET() {
  const result = await healthQuoteProvider.marketYears();
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
