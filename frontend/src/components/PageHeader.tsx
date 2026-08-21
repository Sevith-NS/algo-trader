import clsx from 'clsx';

/**
 * Shared page chrome for the product surfaces (everything except the landing
 * page, which runs in the brand register).
 *
 * These exist because the app had drifted into five different heading
 * treatments and two container widths across nine routes. One primitive per
 * concern keeps a new page from inventing a sixth.
 *
 * The scale is fixed deliberately:
 *   h1          text-3xl/4xl font-black tracking-tight   (matches the landing
 *                                                         page's display voice
 *                                                         one step quieter)
 *   description text-sm leading-relaxed, max 2ch-wide column
 *   eyebrow     mono uppercase 0.22em - rationed, not on every page
 */

const SHELL = 'mx-auto w-full max-w-[1500px] px-4 pb-20 pt-28 sm:px-6 lg:px-8';

export function PageShell({
  children,
  className,
  as: Tag = 'main',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'main' | 'div';
}) {
  return <Tag className={clsx(SHELL, className)}>{children}</Tag>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  meta,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** Small mono label above the title. Use sparingly, not on every page. */
  eyebrow?: string;
  icon?: React.ReactNode;
  /** Controls that belong beside the title (tab strips, refresh, filters). */
  actions?: React.ReactNode;
  /** Mono status line under the title: timestamps, counts, coverage. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx('mb-8', className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-textMuted">
              {eyebrow}
            </p>
          )}
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-textPrimary sm:text-4xl">
            {icon}
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-textSecondary">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 sm:text-right">{actions}</div>}
      </div>
      {meta && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-textMuted">
          {meta}
        </div>
      )}
    </header>
  );
}

/**
 * Section panel used across the product surfaces. Wraps the existing
 * .glass-panel token so panel styling lives in one place rather than being
 * re-derived per page.
 */
export function Panel({
  title,
  icon,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  icon?: React.ReactNode;
  /** Right-aligned count, timestamp or control. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('glass-panel p-5', className)}>
      {(title || aside) && (
        <header className="mb-1 flex items-baseline justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-textSecondary">
              {icon}
              {title}
            </h2>
          )}
          {aside && (
            <span className="tabular shrink-0 font-mono text-[11px] text-textMuted">
              {aside}
            </span>
          )}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
