import { parseMaintenanceMode } from "@anidachi/protocol";
import {
	drainScheduledOutbox,
	type SchedulerEnv,
} from "./scheduled-outbox-drain";

/** Recovery only; all durable work and recipient retry semantics stay in web. */
export const scheduled: ExportedHandlerScheduledHandler<SchedulerEnv> = async (
	_event,
	env,
) => {
	if (parseMaintenanceMode(env.ANIDACHI_MAINTENANCE_MODE) === "closed") {
		console.info("[anidachi/inbox-push] scheduler", {
			outcome: "maintenance_skipped",
		});
		return;
	}
	await drainScheduledOutbox(env, "notifications");
};
