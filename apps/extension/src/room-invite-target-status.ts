import type { RoomInvite } from "@anidachi/protocol";

type RoomInviteRecipientStatus = RoomInvite["recipients"][number]["status"];

export type RoomInviteTargetState = RoomInviteRecipientStatus | "mixed";

export interface RoomInviteTargetStatus {
	readonly state: RoomInviteTargetState;
	readonly recipientStatuses: ReadonlyMap<string, RoomInviteRecipientStatus>;
}

interface RecipientStatusEntry {
	readonly status: RoomInviteRecipientStatus;
	readonly updatedAt: string;
	readonly inviteCreatedAt: string;
}

const STATUS_LABELS: Readonly<Record<RoomInviteRecipientStatus, string>> = {
	accepted: "Accepted",
	declined: "Declined",
	expired: "Expired",
	pending: "Pending",
};

const GROUP_STATUS_ORDER: readonly RoomInviteRecipientStatus[] = [
	"accepted",
	"pending",
	"declined",
	"expired",
];

export function roomInviteTargetStatuses(
	sentInvites: readonly RoomInvite[],
	roomId: string,
): ReadonlyMap<string, RoomInviteTargetStatus> {
	const entriesByTarget = new Map<string, Map<string, RecipientStatusEntry>>();

	for (const invite of sentInvites) {
		if (invite.roomId !== roomId) continue;

		if (invite.targetKind === "group" && invite.targetGroupId) {
			mergeInviteRecipients(
				entriesByTarget,
				`group:${invite.targetGroupId}`,
				invite,
			);
		}

		for (const recipient of invite.recipients) {
			mergeRecipientEntry(
				entriesByTarget,
				`friend:${recipient.user.userId}`,
				recipient.user.userId,
				{
					status: recipient.status,
					updatedAt: recipient.updatedAt,
					inviteCreatedAt: invite.createdAt,
				},
			);
		}
	}

	return finalizeStatuses(entriesByTarget);
}

export function roomInviteGroupStatus(
	statuses: ReadonlyMap<string, RoomInviteTargetStatus>,
	memberUserIds: readonly string[],
): RoomInviteTargetStatus | null {
	const recipients = new Map<string, RoomInviteRecipientStatus>();

	for (const userId of memberUserIds) {
		const status = statuses.get(`friend:${userId}`);
		const recipientStatus = status?.recipientStatuses.get(userId);
		if (recipientStatus) recipients.set(userId, recipientStatus);
	}

	return summarizeRecipients(recipients);
}

export function mergeRoomInviteTargetStatus(
	current: ReadonlyMap<string, RoomInviteTargetStatus>,
	targetKey: string,
	invite: RoomInvite,
): ReadonlyMap<string, RoomInviteTargetStatus> {
	const next = new Map(current);
	const mergedTarget = mergeTargetRecipients(current.get(targetKey), invite);
	if (mergedTarget) next.set(targetKey, mergedTarget);

	for (const recipient of invite.recipients) {
		const friendKey = `friend:${recipient.user.userId}`;
		const mergedFriend = mergeTargetRecipients(current.get(friendKey), {
			...invite,
			recipients: [recipient],
		});
		if (mergedFriend) next.set(friendKey, mergedFriend);
	}

	return next;
}

export function roomInviteTargetStatusLabel(
	status: RoomInviteTargetStatus,
): string {
	if (status.recipientStatuses.size === 1 && status.state !== "mixed") {
		return STATUS_LABELS[status.state];
	}

	const counts = new Map<RoomInviteRecipientStatus, number>();
	for (const recipientStatus of status.recipientStatuses.values()) {
		counts.set(recipientStatus, (counts.get(recipientStatus) ?? 0) + 1);
	}

	return GROUP_STATUS_ORDER.flatMap((recipientStatus) => {
		const count = counts.get(recipientStatus);
		return count
			? [`${count} ${STATUS_LABELS[recipientStatus].toLowerCase()}`]
			: [];
	}).join(" · ");
}

function mergeInviteRecipients(
	entriesByTarget: Map<string, Map<string, RecipientStatusEntry>>,
	targetKey: string,
	invite: RoomInvite,
): void {
	for (const recipient of invite.recipients) {
		mergeRecipientEntry(entriesByTarget, targetKey, recipient.user.userId, {
			status: recipient.status,
			updatedAt: recipient.updatedAt,
			inviteCreatedAt: invite.createdAt,
		});
	}
}

function mergeRecipientEntry(
	entriesByTarget: Map<string, Map<string, RecipientStatusEntry>>,
	targetKey: string,
	recipientUserId: string,
	incoming: RecipientStatusEntry,
): void {
	const recipients = entriesByTarget.get(targetKey) ?? new Map();
	const current = recipients.get(recipientUserId);
	if (!current || isNewerRecipientEntry(incoming, current)) {
		recipients.set(recipientUserId, incoming);
	}
	entriesByTarget.set(targetKey, recipients);
}

function isNewerRecipientEntry(
	incoming: RecipientStatusEntry,
	current: RecipientStatusEntry,
): boolean {
	if (incoming.updatedAt !== current.updatedAt) {
		return incoming.updatedAt > current.updatedAt;
	}
	return incoming.inviteCreatedAt > current.inviteCreatedAt;
}

function finalizeStatuses(
	entriesByTarget: ReadonlyMap<
		string,
		ReadonlyMap<string, RecipientStatusEntry>
	>,
): ReadonlyMap<string, RoomInviteTargetStatus> {
	const statuses = new Map<string, RoomInviteTargetStatus>();
	for (const [targetKey, entries] of entriesByTarget) {
		const recipients = new Map<string, RoomInviteRecipientStatus>();
		for (const [recipientUserId, entry] of entries) {
			recipients.set(recipientUserId, entry.status);
		}
		const summary = summarizeRecipients(recipients);
		if (summary) statuses.set(targetKey, summary);
	}
	return statuses;
}

function mergeTargetRecipients(
	current: RoomInviteTargetStatus | undefined,
	invite: RoomInvite,
): RoomInviteTargetStatus | null {
	const recipients = new Map(current?.recipientStatuses ?? []);
	for (const recipient of invite.recipients) {
		recipients.set(recipient.user.userId, recipient.status);
	}
	return summarizeRecipients(recipients);
}

function summarizeRecipients(
	recipients: ReadonlyMap<string, RoomInviteRecipientStatus>,
): RoomInviteTargetStatus | null {
	const distinctStatuses = [...new Set(recipients.values())];
	const [singleStatus] = distinctStatuses;
	if (!singleStatus) return null;
	return {
		state: distinctStatuses.length === 1 ? singleStatus : "mixed",
		recipientStatuses: new Map(recipients),
	};
}
