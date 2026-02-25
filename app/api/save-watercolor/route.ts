import { supabaseAdmin } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
      const body = await req.json();
      const { watercolorPNG, timestamp, participantId, sessionId } = body;
  
      if (!watercolorPNG || !participantId || !timestamp) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
  
      const base64 = watercolorPNG.replace(/^data:image\/(png|jpeg);base64,/, "");
      const buffer = Buffer.from(base64, "base64");
  
      const filePath = `${participantId}/${participantId}-${timestamp}-watercolor.png`;
  
      const { error: uploadError } = await supabaseAdmin.storage
        .from("drawings")
        .upload(filePath, buffer, { contentType: "image/png" });
  
      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 500 });
      }
  
      const { data: insertedRow, error: insertError } = await supabaseAdmin
        .from("drawings")
        .insert({
          participant_id: participantId,
          session_id: sessionId,
          saved_at: new Date(Number(timestamp)).toISOString(),
          file_path: filePath,
          drawing_type: "watercolor",
        })
        .select()
        .single();
  
      if (insertError) {
        return NextResponse.json({ error: insertError }, { status: 500 });
      }

      const { data: signedData, error: signedError } = await supabaseAdmin
        .storage
        .from("drawings")
        .createSignedUrl(filePath, 60 * 60); // valid 1 hour

      if (signedError) {
        return NextResponse.json({ error: signedError }, { status: 500 });
      }
  
      return NextResponse.json({
        id: insertedRow.id,
        signedUrl: signedData.signedUrl,
        saved_at: insertedRow.saved_at,
      });
    } catch {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }