import { supabaseAdmin } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { participantId, userAgent, appVersion } = await req.json();

    const { data, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        participant_id: participantId,
        user_agent: userAgent,
        app_version: appVersion,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ sessionId: data.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}