import { parseMaintenanceMode } from "@anidachi/protocol";
import type { Env } from "./index";
import { scheduled as recoverNotifications } from "./notification-scheduler";
import {
	drainScheduledOutbox,
	type SchedulerEnv,
} from "./scheduled-outbox-drain";

export const FREE20_RECOVERY_CRON = "*/2 * * * *";
type RecoveryEnv = SchedulerEnv &
	Pick<Env, "ANIDACHI_FREE20_ACCOUNTING_ENABLED">;

/** Distinct schedules keep staging's Supabase invitation timer the sole owner.
 * This drains committed delivery work; it never polls individual room quotas.
 */
export const scheduled: ExportedHandlerScheduledHandler<RecoveryEnv> = async (
	event,
	env,
	ctx,
) => {
	if (event.cron === "* * * * *") {
		await recoverNotifications(event, env, ctx);
		return;
	}
	if (event.cron !== FREE20_RECOVERY_CRON) return;
	if (parseMaintenanceMode(env.ANIDACHI_MAINTENANCE_MODE) === "closed") return;
	if (env.ANIDACHI_FREE20_ACCOUNTING_ENABLED !== "true") return;
	await drainScheduledOutbox(env, "free20_refresh");
};
