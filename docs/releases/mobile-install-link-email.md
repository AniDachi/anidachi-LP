# Mobile install link by email

On a phone, tapping **Install AniDachi** on `/extension` opens the install panel.
**Send install link** emails the official Chrome Web Store listing. Signed-in
visitors can edit the address from their account. Guests can enter an address
without signing in. **Chrome Store** opens the listing directly and **Share link**
uses the existing installation handoff.

The panel posts one address to `/api/extension/install-link`. It shows **Check
your inbox** after Resend accepts the message. The email subject is **Your
AniDachi install link** and the sender is `notifications@anidachi.app`.
The ticket includes an **Install AniDachi** button for desktop Chrome.

The route uses the existing server-side Resend transport, keyed address/IP
hashes and service-role rate-limit RPC. Install requests have separate buckets
for a one-minute address cooldown, three sends per address per hour, twenty per
IP per hour and twenty across the feature per day. A rejected request returns
the wait in the HTTP `Retry-After` header.

For staging acceptance, open `https://staging.anidachi.app/extension` on a
phone, send to your own inbox and open the email on your computer. Check that
the button opens the official listing. Reverting the web patch through a
staging PR restores the previous install panel.
