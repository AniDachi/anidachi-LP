import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { getGmailRedirectUri, sendPlaintextEmail } from "@/lib/kreatli-crm/gmail";
import { appendTouch, readContacts } from "@/lib/kreatli-crm/store";

export const dynamic = "force-dynamic";

type Body = {
  contactId?: string;
  subject?: string;
  body?: string;
  logTouch?: boolean;
};

export async function POST(request: NextRequest) {
  if (!(await verifyKreatliCrmSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: Body;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contactId = json.contactId?.trim();
  const subject = json.subject?.trim() ?? "";
  const body = json.body ?? "";
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "subject required" }, { status: 400 });
  }
  if (!body.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const contacts = await readContacts();
  const c = contacts.find((x) => x.id === contactId);
  if (!c) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = getGmailRedirectUri(origin);

  try {
    const sent = await sendPlaintextEmail(redirectUri, {
      to: c.email,
      subject,
      body,
    });
    if (json.logTouch) {
      await appendTouch({
        id: randomUUID(),
        contact_id: c.id,
        sent_at: new Date().toISOString(),
        summary: `Gmail sent: ${subject}`,
      });
    }
    return NextResponse.json({
      ok: true,
      messageId: sent.id,
      threadId: sent.threadId,
      ...(sent.senderNameNote ? { senderNameNote: sent.senderNameNote } : {}),
      ...(sent.fromMailbox ? { fromMailbox: sent.fromMailbox } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
