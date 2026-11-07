export const FREE20_CLIENT_HEADER = "x-anidachi-free20-client";
export const FREE20_CLIENT_VERSION = 1;

export function parseFree20ClientVersion(value: string | null): 1 | null {
	return value === "1" ? 1 : null;
}
