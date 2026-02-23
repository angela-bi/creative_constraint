import { supabaseAdmin } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
      const body = await req.json();
      const { klecksPNG, timestamp, participantId, sessionId } = body;
  
      if (!klecksPNG || !participantId || !timestamp) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
  
      const base64 = klecksPNG.replace(/^data:image\/(png|jpeg);base64,/, "");
      const buffer = Buffer.from(base64, "base64");
  
      const filePath = `${participantId}/${timestamp}-klecks.png`;
  
      const { error: uploadError } = await supabaseAdmin.storage
        .from("drawings")
        .upload(filePath, buffer, { contentType: "image/png" });
  
      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 500 });
      }
  
      const { error: insertError } = await supabaseAdmin
        .from("drawings")
        .insert({
          participant_id: participantId,
          session_id: sessionId,
          saved_at: new Date(Number(timestamp)).toISOString(),
          file_path: filePath,
          drawing_type: "klecks",
        });
  
      if (insertError) {
        return NextResponse.json({ error: insertError }, { status: 500 });
      }
  
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }