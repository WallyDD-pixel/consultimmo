import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

// Forcer le runtime Node.js (Nodemailer n'est pas compatible Edge)
export const runtime = 'nodejs';

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

    // Envoi d'email (si SMTP configuré)
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      MAIL_TO,
      MAIL_FROM
    } = process.env as Record<string, string | undefined>;

    if (SMTP_HOST && SMTP_PORT && MAIL_TO) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      });

      const subject = `Nouveau contact (${record.id}) – ${data.nom || 'Sans nom'}`;
      const text = `Nouveau formulaire reçu:\n\n` +
        `Nom: ${data.nom || ''}\n` +
        `Email: ${data.email || ''}\n` +
        `Téléphone: ${data.phone || ''}\n` +
        `Déjà acheté: ${data.dejaAchete || ''}\n` +
        `Déjà visité: ${data.dejaVisite || ''}\n` +
        `Avocat: ${data.avocat || ''}\n` +
        `Budget: ${data.budget || ''}\n` +
        `Source: ${data.source || 'questionnaire'}\n`;

      try {
        await transporter.sendMail({
          from: MAIL_FROM || SMTP_USER || 'no-reply@immoencheres.com',
          to: MAIL_TO,
          subject,
          text,
        });
      } catch (err) {
        // On ne bloque pas la réponse si l'email échoue
        console.error('Email send failed:', err);
      }
    }
    return NextResponse.json({ ok: true, id: record.id });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
