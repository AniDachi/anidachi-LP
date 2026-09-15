/** First-party cookie so the zip download API can stitch Amplitude device ids. */
export const AMPLITUDE_DEVICE_COOKIE = "anidachi_amp_device_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAmplitudeInsertId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}
