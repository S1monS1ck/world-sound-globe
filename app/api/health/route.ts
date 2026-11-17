import { NextResponse } from "next/server";

// Deployment smoke check: confirms the Next server is serving API traffic.
export function GET() {
  return NextResponse.json({ ok: true });
}
