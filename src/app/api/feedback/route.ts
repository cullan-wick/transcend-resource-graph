import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not Implemented", milestone: "M4 scaffold" },
    { status: 501 },
  );
}
