import { describe, expect, it } from "vitest";
import * as terminal from "../src/room-terminal";
import { parseRoomTerminalIntent as parseRollbackIntent } from "./fixtures/room-terminal-before-retry-budget";
const oldIntent = { schemaVersion: 1, fencedAt: 100, finalizedAt: null, nextAttemptAt: 900, endedAt: 100, reason: "host_ended" };
describe("durable terminal retry budget", () => {
    it("retains an old deadline and fence while accepting additive retry metadata", () => {
        expect(terminal.parseRoomTerminalIntent(oldIntent)).toMatchObject(oldIntent);
        expect(terminal.parseRoomTerminalIntent({ ...oldIntent, attempts: 4 })).toMatchObject({ ...oldIntent, attempts: 4 });
        // A rollback ignores additive metadata without changing the existing fence/deadline.
    expect(parseRollbackIntent({ ...oldIntent, attempts: 4 })).toMatchObject(oldIntent);
    expect(parseRollbackIntent({ ...oldIntent, attempts: 4 })).not.toHaveProperty("attempts");
    });
    it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("fails closed on invalid persisted attempt count %s", attempts => {
        expect(() => terminal.parseRoomTerminalIntent({ ...oldIntent, attempts })).toThrow("Invalid durable terminal intent");
    });
    it("caps retry intervals with positive jitter and checked timestamp arithmetic", () => {
        const retryAt = (terminal as any).roomTerminalRetryAt;
        expect(typeof retryAt).toBe("function");
        const delays = [30000, 60000, 120000, 240000, 300000, 300000];
        for (let i = 0; i < delays.length; i++) {
            expect(retryAt(i + 1, 1000, 0)).toBe(1000 + delays[i]!);
            expect(retryAt(i + 1, 1000, 1)).toBe(1000 + delays[i]! * 1.1);
        }
        expect(retryAt(100, Number.MAX_SAFE_INTEGER - 1, 1)).toBe(Number.MAX_SAFE_INTEGER);
    });
});
