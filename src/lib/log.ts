/**
 * Browser logging that behaves differently in a production build.
 *
 * The app shipped ~60 raw `console.*` calls. Most were development breadcrumbs
 * that ended up in users' consoles, and a few of them logged request payloads —
 * which is how customer data leaks into a screenshot from a support ticket.
 *
 * Errors are deliberately still emitted in production. When a user reports "it
 * just stopped working", the browser console is often the only evidence anyone
 * has, and suppressing it buys nothing.
 */
const isDev = import.meta.env.DEV;

type LogArgs = unknown[];

export const log = {
  /** Development only. */
  debug: (...args: LogArgs) => {
    if (isDev) console.debug(...args);
  },
  /** Development only. */
  info: (...args: LogArgs) => {
    if (isDev) console.info(...args);
  },
  /** Development only — a warning the user cannot act on is noise in production. */
  warn: (...args: LogArgs) => {
    if (isDev) console.warn(...args);
  },
  /** Kept in production: the only breadcrumb a support request usually has. */
  error: (...args: LogArgs) => {
    console.error(...args);
  },
};
