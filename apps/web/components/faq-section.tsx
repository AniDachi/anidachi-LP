"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { HomeSectionHeader } from "@/components/home-section-header";

export interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSection({
  title = "Frequently asked questions",
  questions,
  defaultOpenIndexes = [],
  compact = false,
}: {
  title?: string;
  questions: FAQItem[];
  defaultOpenIndexes?: number[];
  compact?: boolean;
}) {
  return (
    <section
      id="faq"
      className={compact ? "bg-ani-canvas pt-12" : "bg-ani-canvas py-16 lg:py-24"}
    >
      <div className={compact ? undefined : "container mx-auto max-w-3xl px-4"}>
        {compact ? (
          <h2 className="mb-4 text-lg font-semibold tracking-[-0.02em] text-ani-text">
            {title}
          </h2>
        ) : (
          <HomeSectionHeader title={title} />
        )}
        <div className="divide-y divide-ani-line overflow-hidden rounded-[20px] border border-ani-line">
          {questions.map((q, i) => (
            <FAQAccordion
              key={i}
              question={q.question}
              answer={q.answer}
              defaultOpen={defaultOpenIndexes.includes(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQAccordion({
  question,
  answer,
  defaultOpen = false,
}: FAQItem & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        className="group flex min-h-12 w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium tracking-[-0.01em] text-ani-text motion-safe:transition-colors motion-safe:duration-[160ms] hover:bg-ani-hover"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-pretty">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ani-progress motion-safe:transition-transform motion-safe:duration-[180ms] ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="px-5 pb-5 text-sm leading-relaxed text-ani-muted">
          {answer}
        </div>
      ) : null}
    </div>
  );
}
