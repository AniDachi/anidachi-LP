import { redirect } from "next/navigation";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { listContactMessages } from "@/lib/kreatli-crm/contact-messages";
import { listFeatureRequests } from "@/lib/kreatli-crm/feature-requests";
import { getGmailUiStatus } from "@/lib/kreatli-crm/gmail-ui";
import { readContacts, readTouches } from "@/lib/kreatli-crm/store";
import { listTemplateSlugs } from "@/lib/kreatli-crm/templates";
import { CrmClient } from "./crm-client";

export const dynamic = "force-dynamic";

export default async function KreatliCrmPage() {
  if (!(await verifyKreatliCrmSession())) {
    redirect("/kreatli-email-crm/login");
  }

  const [
    contacts,
    touches,
    templateSlugs,
    gmailStatus,
    contactMessages,
    featureRequests,
  ] = await Promise.all([
    readContacts(),
    readTouches(),
    listTemplateSlugs(),
    getGmailUiStatus(),
    listContactMessages(),
    listFeatureRequests(),
  ]);
  return (
    <CrmClient
      contacts={contacts}
      touches={touches}
      templateSlugs={templateSlugs}
      gmailStatus={gmailStatus}
      contactMessages={contactMessages}
      featureRequests={featureRequests}
    />
  );
}
