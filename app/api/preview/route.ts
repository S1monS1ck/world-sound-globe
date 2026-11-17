import { NextResponse, type NextRequest } from "next/server";
import { getCityPreviews } from "@/server/lib/preview";
import { parseCityId } from "@/server/lib/types";

// Thin shell around the framework-agnostic preview lookup.
export async function GET(request: NextRequest) {
  const parsed = parseCityId(request.nextUrl.searchParams.get("city"));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const tracks = await getCityPreviews(parsed.city.id, parsed.city);
  return NextResponse.json(tracks);
}
