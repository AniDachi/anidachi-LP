import {
	billingPeriodUnit,
	formatBillingTime,
	formatMonthlyPrice,
	type BillingSubscription,
} from "@/lib/billing-view";

/** Presentation only. Discounted amounts come from the verified billing response. */
export function PaidSubscriptionFacts({
	subscription: s,
	timeZone,
}: {
	subscription: BillingSubscription;
	timeZone: string;
}) {
	const regularPrice = s.price ?? s.monthlyPrice;
	const promotion = s.promotion;
	const renewing = !s.cancelAtPeriodEnd;
	const nextPrice = promotion
		? promotion.state === "active"
			? (promotion.nextPrice ??
				(promotion.campaign === "cancellation_retention" ? s.price : null))
			: null
		: regularPrice;
	const price = renewing ? nextPrice : regularPrice;
	const period = s.price?.billingPeriod ?? "monthly";
	const discounted = Boolean(
		renewing &&
			promotion?.state === "active" &&
			nextPrice &&
			regularPrice &&
			nextPrice.currency === regularPrice.currency &&
			nextPrice.unitAmount < regularPrice.unitAmount,
	);
	const date = s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null;
	const dateText =
		date && Number.isFinite(date.getTime())
			? new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone }).format(date)
			: "Date unavailable";
	const regularLabel = regularPrice
		? `${formatMonthlyPrice(regularPrice)}/${billingPeriodUnit(period)}`
		: "the regular price";
	let offerNote: string | null = null;
	if (renewing && promotion?.state === "active") {
		if (promotion.campaign === "cancellation_retention") {
			offerNote = discounted
				? `Next month only. Then ${regularLabel}.`
				: null;
		} else if (promotion.campaign === "uninstall_renewal") {
			offerNote = discounted
				? `Next month only. Then ${regularLabel}.`
				: "Your next renewal is at the regular price.";
		} else if (promotion.campaign === "uninstall_first") {
			offerNote =
				"First-month discount applied. Next renewal at the regular price.";
		} else if (promotion.endsAt) {
			offerNote = `Discount ends ${formatBillingTime(promotion.endsAt, timeZone)}. Then ${regularLabel}.`;
		}
	}
	return (
		<div className="billing-payment-overview">
			<dl className="billing-payment-facts">
				<div>
					<dt>{renewing ? "Next payment" : "Access until"}</dt>
					<dd className="billing-payment-date">{dateText}</dd>
					{!renewing && <dd className="billing-payment-caption">No renewal payments</dd>}
				</div>
				<div>
					<dt>{renewing ? "Amount" : "Plan price"}</dt>
					<dd
						className={`billing-payment-amount${price ? "" : " billing-payment-unavailable"}`}
					>
						{price ? (
							<>
								{formatMonthlyPrice(price)}
								{!renewing && <span> / {billingPeriodUnit(period)}</span>}
							</>
						) : (
							"Amount unavailable"
						)}
						{discounted && promotion?.percentOff != null && (
							<span className="billing-discount-label">
								{promotion.percentOff}% off
							</span>
						)}
					</dd>
					{offerNote && <dd className="billing-payment-caption">{offerNote}</dd>}
					{renewing && price && !offerNote && (
						<dd className="billing-payment-caption">
							{period === "yearly" ? "Yearly billing" : "Monthly billing"}
						</dd>
					)}
					{renewing && !nextPrice && (
						<dd className="billing-payment-caption">
							Refresh status to check your next payment.
						</dd>
					)}
				</div>
			</dl>
		</div>
	);
}
