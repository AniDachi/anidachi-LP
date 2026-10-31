import {
	HostingTimeBindingSchema,
	HostingTimeSnapshotSchema,
	type HostingTimeBinding,
	type HostingTimeSnapshot,
} from "./hosting-time";

function matchesScope(
	binding: HostingTimeBinding,
	snapshot: HostingTimeSnapshot,
): boolean {
	return (
		snapshot.ownerUserId === binding.ownerUserId &&
		snapshot.roomId === binding.roomId &&
		snapshot.roomGeneration === binding.roomGeneration
	);
}

/** Decode and fence raw data before later presentation. Null means rejected or
 * unavailable, never unlimited. Keep any last ordering anchor separately from
 * unknown presentation; do not treat an invalid response as fresh authority.
 * A binding must come from the still-live authenticated room lifecycle and its
 * trusted UTC day, never the incoming object. This helper does not authenticate,
 * assess current entitlement freshness, admit/end a room, or run local rollover.
 * Clear current when the authenticated owner/room/generation changes.
 */
export function acceptHostingTimeSnapshot(
	expected: HostingTimeBinding,
	current: unknown,
	incoming: unknown,
): HostingTimeSnapshot | null {
	const binding = HostingTimeBindingSchema.safeParse(expected);
	const next = HostingTimeSnapshotSchema.safeParse(incoming);
	if (
		!binding.success ||
		!next.success ||
		!matchesScope(binding.data, next.data) ||
		next.data.period.utcDay !== binding.data.utcDay
	)
		return null;
	if (current !== null) {
		const previous = HostingTimeSnapshotSchema.safeParse(current);
		if (
			!previous.success ||
			!matchesScope(binding.data, previous.data) ||
			next.data.snapshotSequence <= previous.data.snapshotSequence ||
			next.data.serverTime < previous.data.serverTime ||
			next.data.period.utcDay < previous.data.period.utcDay
		)
			return null;
	}
	return next.data;
}
