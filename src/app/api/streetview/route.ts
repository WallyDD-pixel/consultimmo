import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = url.searchParams.get("size") || "960x540";
  const location = url.searchParams.get("location");
  const heading = url.searchParams.get("heading") || "0";
  const pitch = url.searchParams.get("pitch") || "0";
  const fov = url.searchParams.get("fov") || "80";
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!location) {
    return NextResponse.json({ error: "Missing location" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const gUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
  gUrl.searchParams.set("size", size);
  gUrl.searchParams.set("location", location);
  gUrl.searchParams.set("heading", heading);
  gUrl.searchParams.set("pitch", pitch);
  gUrl.searchParams.set("fov", fov);
  gUrl.searchParams.set("key", key);

  try {
    const resp = await fetch(gUrl.toString());
    if (!resp.ok) {
      const txt = await resp.text();
      return new NextResponse(txt, { status: resp.status });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": resp.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "streetview proxy error" }, { status: 500 });
  }
}
