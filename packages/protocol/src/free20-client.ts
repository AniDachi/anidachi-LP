export const FREE20_CLIENT_HEADER = "x-anidachi-free20-client";
export const FREE20_CLIENT_VERSION = 2;

export function parseFree20ClientVersion(value: string | null): 1 | 2 | null {
	if (value === "2") return 2;
	return value === "1" ? 1 : null;
}
