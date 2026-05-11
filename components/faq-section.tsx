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
    <section id="faq" className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
          {title}
        </h2>
        <div className="space-y-4">
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
    <div className="border border-gray-200 rounded-lg">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left text-gray-900 font-medium hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-gray-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-6 pb-4 text-gray-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
