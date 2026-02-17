import { supabaseAdmin } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { watercolorPNG, klecksPNG, timestamp, participantId } = body;

    if (!watercolorPNG || !klecksPNG || !participantId || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Remove base64 prefixes
    // console.log("typeof watercolorPNG:", typeof watercolorPNG);
    const watercolorBase64 = watercolorPNG.replace(
      /^data:image\/(png|jpeg);base64,/,
      ""
    );
    // console.log("typeof klecksPNG:", typeof klecksPNG);
    // console.log("klecksPNG:", klecksPNG);
    const klecksBase64 = klecksPNG.replace(
      /^data:image\/(png|jpeg);base64,/,
      ""
    );

    const watercolorBuffer = Buffer.from(watercolorBase64, "base64");
    const klecksBuffer = Buffer.from(klecksBase64, "base64");

    const watercolorPath = `${participantId}/${timestamp}-watercolor.png`;
    const klecksPath = `${participantId}/${timestamp}-klecks.png`;

    // Upload watercolor
    const { error: watercolorError } = await supabaseAdmin.storage
      .from("drawings")
      .upload(watercolorPath, watercolorBuffer, {
        contentType: "image/png",
      });

    if (watercolorError) {
      console.error("Watercolor upload error:", watercolorError);
      return NextResponse.json({ error: watercolorError }, { status: 500 });
    }

    // Upload klecks
    const { error: klecksError } = await supabaseAdmin.storage
      .from("drawings")
      .upload(klecksPath, klecksBuffer, {
        contentType: "image/png",
      });

    if (klecksError) {
      console.error("Klecks upload error:", klecksError);
      return NextResponse.json({ error: klecksError }, { status: 500 });
    }

    // Insert DB row
    const { error: insertError } = await supabaseAdmin
      .from("drawings")
      .insert({
        participant_id: participantId,
        saved_at: new Date(Number(timestamp)).toISOString(),
        watercolor_path: watercolorPath,
        klecks_path: klecksPath,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: insertError }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
