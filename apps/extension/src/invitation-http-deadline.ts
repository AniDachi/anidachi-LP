import { RoomApiError } from "./room-client";

// One deadline covers both response headers and body decoding. Abort alone is
// insufficient when a browser/network body read never settles.
export async function withInvitationHttpDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  code = "INBOX_REQUEST_TIMEOUT",
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new RoomApiError("Invitation request timed out. Try again.", code));
          controller.abort();
        }, 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
