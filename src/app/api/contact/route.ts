import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
    const record = await prisma.contactSubmission.create({
      data: {
        dejaAchete: String(data.dejaAchete).toLowerCase() === 'oui',
        dejaVisite: String(data.dejaVisite).toLowerCase() === 'oui',
        nom: String(data.nom || '').slice(0, 100),
        avocat: String(data.avocat).toLowerCase() === 'oui',
        budget: Number(data.budget) || 0,
        email: String(data.email || '').slice(0, 200),
        phone: String(data.phone || '').slice(0, 50),
        source: String(data.source || 'questionnaire'),
      },
    });
    return NextResponse.json({ ok: true, id: record.id });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
