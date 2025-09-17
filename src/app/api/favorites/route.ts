import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "fav";

async function readFavorites(): Promise<number[]> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value || "[]";
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => Number.isInteger(x));
    return [];
  } catch {
    return [];
  }
}

function writeFavorites(res: NextResponse, favs: number[]) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: JSON.stringify(Array.from(new Set(favs))),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function GET() {
  const favs = await readFavorites();
  return NextResponse.json({ favorites: favs });
}

export async function POST(req: Request) {
  try {
  const { id, action } = await req.json();
  const favs = await readFavorites();
    const num = Number(id);
    if (!Number.isInteger(num)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    let out = favs;
    if (action === "add") {
      out = Array.from(new Set([...favs, num]));
    } else if (action === "remove") {
      out = favs.filter((x) => x !== num);
    } else if (action === "toggle" || !action) {
      out = favs.includes(num) ? favs.filter((x) => x !== num) : [...favs, num];
    } else {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }
    const res = NextResponse.json({ favorites: out, isFavorite: out.includes(num) });
    writeFavorites(res, out);
    return res;
  } catch (e) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
