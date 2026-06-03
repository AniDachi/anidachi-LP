import { redirect } from "next/navigation";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { readContacts, readTouches } from "@/lib/kreatli-crm/store";
import { getGmailUiStatus } from "@/lib/kreatli-crm/gmail-ui";
import { listTemplateSlugs } from "@/lib/kreatli-crm/templates";
import { CrmClient } from "./crm-client";

export const dynamic = "force-dynamic";

export default async function KreatliCrmPage() {
  if (!(await verifyKreatliCrmSession())) {
    redirect("/kreatli-email-crm/login");
  }

  const [contacts, touches, templateSlugs, gmailStatus] = await Promise.all([
    readContacts(),
    readTouches(),
    listTemplateSlugs(),
    getGmailUiStatus(),
  ]);
  return (
    <CrmClient
      contacts={contacts}
      touches={touches}
      templateSlugs={templateSlugs}
      gmailStatus={gmailStatus}
    />
  );
}
