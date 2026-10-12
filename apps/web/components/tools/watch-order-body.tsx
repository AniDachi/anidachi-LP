import Link from "next/link";
import { HowToJsonLd, ItemListJsonLd } from "@/components/json-ld";
import { SeoGuideRelated } from "@/components/seo-guide-blocks";
import { CopyRanges } from "@/components/tools/copy-ranges";
import { StatStrip } from "@/components/tools/stat-strip";
import {
  orderAsText,
  stepAnchor,
  totalHours,
  type WatchOrder,
  type WatchOrderEntry,
} from "@/lib/tools/watch-orders";

const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";

function EntryMeta({ entry }: { entry: WatchOrderEntry }) {
  return (
    <span className="text-xs tabular-nums text-ani-muted sm:text-sm">
      {entry.year} · {entry.format} · {entry.length}
    </span>
  );
}

export function WatchOrderBody({
  order,
  url,
  orderHeading,
  orderIntro,
  laterHeading,
  laterIntro,
  related,
}: {
  order: WatchOrder;
  url: string;
  orderHeading: string;
  orderIntro: string;
  laterHeading: string;
  laterIntro: string;
  related: { href: string; label: string }[];
}) {
  const steps = order.firstWatch.map((entry) => ({
    name: `${entry.title} (${entry.year})`,
    text: entry.note,
  }));

  return (
    <>
      <HowToJsonLd
        name={`${order.title} watch order`}
        description={`First-watch order for ${order.title}, checked ${order.checked}.`}
        steps={steps}
      />
      <ItemListJsonLd
        name={`${order.title} watch order`}
        items={order.firstWatch.map((entry, i) => ({
          name: entry.title,
          url: `${url}#${stepAnchor(i)}`,
          position: i + 1,
        }))}
      />

      <StatStrip
        stats={[
          { label: "Steps on a first watch", value: String(order.firstWatch.length) },
          { label: "Hours, roughly", value: `~${totalHours(order.firstWatch)}` },
          { label: "Left for later", value: String(order.later.length) },
          { label: "Checked", value: order.checked },
        ]}
      />

      <h2 id="order" className={headingClass}>
        {orderHeading}
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">{orderIntro}</p>
      <div className="not-prose mb-4">
        <CopyRanges text={orderAsText(order)} label="Copy watch order" />
      </div>
      <ol className="not-prose mb-4 divide-y divide-ani-line overflow-hidden rounded-[16px] border border-ani-line">
        {order.firstWatch.map((entry, i) => (
          <li
            key={entry.title}
            id={stepAnchor(i)}
            className="grid scroll-mt-24 grid-cols-[2rem_1fr] gap-x-3 px-4 py-4 sm:grid-cols-[2.25rem_1fr] sm:px-5"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ani-line bg-ani-hover font-mono text-sm font-semibold tabular-nums text-ani-text"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ani-text">{entry.title}</span>
              <EntryMeta entry={entry} />
              <span className="mt-1 block text-sm leading-relaxed text-ani-muted">
                {entry.note}
              </span>
              {entry.watchSlug ? (
                <Link
                  href={`/watch/${entry.watchSlug}-with-friends`}
                  className="mt-1.5 inline-block text-sm font-medium text-ani-text underline decoration-ani-line underline-offset-4 hover:decoration-ani-text"
                >
                  Watch {entry.title} with friends
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      <h2 id="later" className={headingClass}>
        {laterHeading}
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">{laterIntro}</p>
      <ul className="not-prose mb-10 grid gap-2 sm:grid-cols-2">
        {order.later.map((entry) => (
          <li
            key={entry.title}
            className="rounded-[12px] border border-ani-line bg-ani-panel px-4 py-3"
          >
            <span className="block font-medium text-ani-text">{entry.title}</span>
            <EntryMeta entry={entry} />
            <span className="mt-1 block text-sm leading-relaxed text-ani-muted">{entry.note}</span>
          </li>
        ))}
      </ul>

      <h2 id="related" className={headingClass}>
        Related
      </h2>
      <SeoGuideRelated links={related} className="mb-8" />
    </>
  );
}
