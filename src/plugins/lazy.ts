import type { RouterPlugin } from '../web-router.js';

/**
 * Creates a lazy loading plugin that dynamically imports a module
 * before the route renders.
 *
 * @param importFn - A function returning a dynamic import
 * @returns A RouterPlugin that loads the module on navigation
 *
 * @example
 * ```typescript
 * const routes: Route[] = [
 *   {
 *     path: '/about',
 *     title: 'About',
 *     plugins: [lazy(() => import('./pages/about.js'))],
 *     render: () => html`<about-page></about-page>`,
 *   },
 * ];
 * ```
 */
export function lazy(importFn: () => Promise<unknown>): RouterPlugin {
  return {
    name: 'lazy',
    beforeNavigation: () => importFn(),
  };
}
