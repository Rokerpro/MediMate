import type { ReactNode } from "react";

/**
 * Shared page heading: small kicker, serif title and a short description.
 * `actions` sits to the right on wide screens (e.g. a print button).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-3xl">
        <p className="landing-kicker">{eyebrow}</p>
        <h1 className="display-font mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-[#254a38] sm:text-5xl">
          {title}
        </h1>
        {description && <div className="mt-3 max-w-2xl leading-7 text-[#5b6b61]">{description}</div>}
        {children}
      </div>
      {actions && <div className="shrink-0 print:hidden">{actions}</div>}
    </header>
  );
}
