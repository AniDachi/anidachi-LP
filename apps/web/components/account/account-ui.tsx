import type { ReactNode } from "react";

export function AccountPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="ac-page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="ac-header-actions">{action}</div> : null}
    </header>
  );
}

export function AccountEmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ac-empty">
      {icon ? (
        <span className="ac-empty-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

// These buttons filter one workspace. Native buttons preserve keyboard behavior
// without pretending to be ARIA tabs with a separate focus model.
export function AccountSectionSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ac-section-switch" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span> {option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
