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
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-ani-canvas px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] ${className}`}
    >
      <div className={`relative mx-auto w-full ${maxWidth}`}>{children}</div>
    </main>
  );
}

export function AuthPageCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-ani-line bg-ani-panel p-8">
      {children}
    </div>
  );
}
