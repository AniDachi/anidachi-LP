import { Minus, Plus } from "lucide-react";
import styles from "./home/home-faq.module.css";

export interface FAQItem {
  question: string;
  answer: string;
}

const visibleLimit = 6;

export function FaqQuestionList({
  questions,
  openIndexes = [],
}: {
  questions: FAQItem[];
  openIndexes?: number[];
}) {
  const split = Math.ceil(questions.length / 2);

  return (
    <div className={styles.columns}>
      {[0, 1].map((columnIndex) => {
        const start = columnIndex === 0 ? 0 : split;
        const column = questions.slice(start, columnIndex === 0 ? split : undefined);
        if (column.length === 0) return null;
        return (
          <div key={columnIndex}>
            {column.map((item, itemIndex) => {
              const index = start + itemIndex;
              return (
                <details
                  key={`${index}-${item.question}`}
                  className={styles.question}
                  open={openIndexes.includes(index) ? true : undefined}
                >
                  <summary>
                    <span>{item.question}</span>
                    <Plus className={styles.plus} size={18} aria-hidden="true" />
                    <Minus className={styles.minus} size={18} aria-hidden="true" />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              );
            })}
          </div>
        );
      })}
    </div>
  );
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
  const visible = questions.slice(0, visibleLimit);
  const hidden = questions.slice(visibleLimit);
  const visibleOpen = defaultOpenIndexes.filter((index) => index < visible.length);
  const hiddenOpen = defaultOpenIndexes
    .filter((index) => index >= visible.length)
    .map((index) => index - visible.length);

  return (
    <section
      id="faq"
      className={compact ? styles.compact : styles.section}
      aria-labelledby="faq-title"
    >
      <div className={styles.container}>
        <h2 id="faq-title">{title}</h2>
        <FaqQuestionList questions={visible} openIndexes={visibleOpen} />
        {hidden.length > 0 ? (
          <details className={styles.more} open={hiddenOpen.length > 0 ? true : undefined}>
            <summary>
              <span className={styles.closedLabel}>More questions</span>
              <span className={styles.openLabel}>Fewer questions</span>
              <Plus className={styles.plus} size={18} aria-hidden="true" />
              <Minus className={styles.minus} size={18} aria-hidden="true" />
            </summary>
            <FaqQuestionList questions={hidden} openIndexes={hiddenOpen} />
          </details>
        ) : null}
      </div>
    </section>
  );
}
