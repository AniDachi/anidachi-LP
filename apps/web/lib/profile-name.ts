// Email-created accounts start with this placeholder until their owner picks a name.
export function needsProfileName(value: string | null | undefined): boolean {
	return !value?.trim() || value.trim() === "AniDachi user";
}
