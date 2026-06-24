import type { ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
  maxWidth?: string;
  className?: string;
};

export function AuthPageShell({
  children,
  maxWidth = "max-w-sm",
  className = "",
}: AuthPageShellProps) {
  return (
    <main
      id="main-content"
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-brand-orange/8 blur-[100px]" />
      </div>
      <div className={`relative mx-auto w-full ${maxWidth}`}>{children}</div>
    </main>
  );
}

export function AuthPageCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 shadow-xl">
      {children}
    </div>
  );
}
