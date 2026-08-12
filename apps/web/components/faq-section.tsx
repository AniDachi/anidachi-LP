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
}: {
  title?: string;
  questions: FAQItem[];
  defaultOpenIndexes?: number[];
}) {
  return (
    <section id="faq" className="bg-background py-16 lg:py-24">
      <div className="container mx-auto max-w-3xl px-4">
        <HomeSectionHeader title={title} />
        <div className="divide-y divide-brand-border/60 overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface">
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
        className="group flex min-h-12 w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium tracking-[-0.01em] text-foreground transition-colors hover:bg-brand-orange/[0.06]"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-pretty">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-brand-orange transition-transform duration-200 ease-out ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="px-5 pb-5 text-sm leading-relaxed text-foreground/70">
          {answer}
        </div>
      ) : null}
    </div>
  );
}
