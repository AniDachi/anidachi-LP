/** Presentation-safe link contract; no Chrome bridge or account client imports. */
export interface FriendInviteLink {
	url: string;
	expiresAt: string;
}
