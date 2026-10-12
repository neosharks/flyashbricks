/**
 * Stands in for the `server-only` package under Vitest.
 *
 * That package throws on import unless the bundler resolved it through the
 * `react-server` condition, which is what makes it a real build-time guard in
 * the app. Tests exercise those same modules directly, so they resolve this
 * empty module instead. The guard still holds where it matters — `next build`
 * fails if a client component reaches a server-only module.
 */
export {};
