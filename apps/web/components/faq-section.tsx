"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSection({
  title = "Frequently Asked Questions",
  questions,
  defaultOpenIndexes = [],
}: {
  title?: string;
  questions: FAQItem[];
  defaultOpenIndexes?: number[];
}) {
  return (
    <section id="faq" className="bg-background py-16 lg:py-20">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-brand-orange">
            FAQ
          </div>
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">{title}</h2>
          <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
        </div>
        <div className="space-y-3">
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
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
      <button
        className={`group flex w-full items-center justify-between px-5 py-3.5 text-left font-medium text-foreground transition-colors hover:bg-brand-orange hover:text-primary-foreground ${
          open ? "rounded-t-lg" : "rounded-lg"
        }`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-brand-orange transition-all duration-200 group-hover:text-primary-foreground ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-brand-border px-5 pb-3.5 pt-0 text-sm leading-relaxed text-foreground/70">
          <div className="pt-3">{answer}</div>
        </div>
      )}
    </div>
  );
}
