import { supabaseAdmin } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { sessionId, participantId, eventType, metadata } =
      await req.json();

    if (!sessionId || !participantId || !eventType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("events").insert({
      session_id: sessionId,
      participant_id: participantId,
      event_type: eventType,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error("Event insert error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Log event error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}