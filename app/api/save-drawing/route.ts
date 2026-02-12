import { supabaseAdmin } from "../../../lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { watercolorPNG, timestamp, participantId } = body;

    if (!watercolorPNG || !participantId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (typeof watercolorPNG !== "string") {
      return NextResponse.json(
        { error: "watercolorPNG must be a base64 data URL string" },
        { status: 400 }
      );
    }

    // Remove data URL prefix
    const base64 = watercolorPNG.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    const filePath = `${participantId}/${timestamp}-watercolor.png`;

    // Upload to private bucket
    const { error } = await supabaseAdmin.storage
      .from("drawings") // your bucket name
      .upload(filePath, buffer, {
        contentType: "image/png",
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    // Log metadata in database
    const { error: insertError } = await supabaseAdmin.from("submissions").insert({
      participant_id: participantId,
      timestamp,
      file_path: filePath,
      type: "watercolor",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: insertError }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Server error:", message, stack);

    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { details: message }),
      },
      { status: 500 }
    );
  }
}
