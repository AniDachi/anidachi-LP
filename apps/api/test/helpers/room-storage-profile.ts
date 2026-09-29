import { vi } from "vitest";

/** Observe real storage; never replace writes or consume the application's cursor. */
export function observeRoomStorage(storage: DurableObjectStorage) {
  const cursors: Array<{ cursor: ReturnType<SqlStorage["exec"]>; key: string }> = [];
  const operations = { kvPuts: 0, kvDeletes: 0, alarmSets: 0, alarmDeletes: 0 };
  const restores: Array<() => void> = [];
  const observed = new WeakSet<object>();
  function observePort(port: DurableObjectStorage | DurableObjectTransaction) {
    if (observed.has(port)) return;
    observed.add(port);
    for (const [method, counter] of [
      ["put", "kvPuts"], ["delete", "kvDeletes"],
      ["setAlarm", "alarmSets"], ["deleteAlarm", "alarmDeletes"],
    ] as const) {
      const original = port[method];
      const spy = vi.spyOn(port, method).mockImplementation((...args: unknown[]) => {
        operations[counter]++;
        return Reflect.apply(original, port, args);
      });
      restores.push(() => spy.mockRestore());
    }
  }
  observePort(storage);
  const exec = storage.sql.exec.bind(storage.sql);
  const sqlSpy = vi.spyOn(storage.sql, "exec").mockImplementation((query, ...bindings) => {
    const cursor = exec(query, ...bindings);
    const key = /INSERT INTO room_meta/i.test(query)
      ? String(bindings[0])
      : /room_media_seat_denials/i.test(query) ? "media_seat_denials" : "other";
    cursors.push({ cursor, key });
    return cursor;
  });
  restores.push(() => sqlSpy.mockRestore());
  const transaction = storage.transaction.bind(storage);
  const transactionSpy = vi.spyOn(storage, "transaction").mockImplementation((callback) =>
    transaction((port) => {
      observePort(port);
      return callback(port);
    }),
  );
  restores.push(() => transactionSpy.mockRestore());
  return {
    snapshot() {
      const sqlByKey: Record<string, number> = {};
      let sqlRowsWritten = 0;
      for (const { cursor, key } of cursors) {
        sqlRowsWritten += cursor.rowsWritten;
        sqlByKey[key] = (sqlByKey[key] ?? 0) + cursor.rowsWritten;
      }
      return { sqlRowsWritten, sqlByKey, ...operations };
    },
    restore() { for (const restore of restores.reverse()) restore(); },
  };
}
