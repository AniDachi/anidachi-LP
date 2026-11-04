import { getJwtSecret } from "./jwt";
import { getPricingOffer } from "./pricing-offer";
import { createStripeClient } from "./stripe-env";
import { subscriptionCheckoutService } from "./subscription-checkout-server";
import {
	readUninstallCatalog,
	uninstallCampaignConfig,
} from "./uninstall-config";
import { createUninstallService } from "./uninstall-service";
import {
	readRetentionClaim,
	readUninstallAccount,
	reserveRetention,
} from "./uninstall-store";

export function uninstallService() {
	const stripe = createStripeClient();
	return createUninstallService({
		stripe,
		secret: getJwtSecret(),
		config: uninstallCampaignConfig,
		catalog: () => readUninstallCatalog(stripe),
		purchaseOffer: getPricingOffer,
		account: readUninstallAccount,
		readClaim: readRetentionClaim,
		reserve: reserveRetention,
		checkout: (input) =>
			subscriptionCheckoutService(stripe, {
				withoutTrial: true,
				uninstallOffer: true,
			}).prepareSubscriptionCheckout(input),
	});
}
