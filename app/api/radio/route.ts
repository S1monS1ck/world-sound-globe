import { NextResponse, type NextRequest } from "next/server";
import { getCityRadio } from "@/server/lib/radio";
import { parseCityId } from "@/server/lib/types";

// Thin shell around the framework-agnostic radio lookup.
export async function GET(request: NextRequest) {
  const parsed = parseCityId(request.nextUrl.searchParams.get("city"));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const radio = await getCityRadio(parsed.city.id, parsed.city);
  return NextResponse.json(radio);
}
