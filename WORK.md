# Web Router - Work Log

## Goal
Make this a modern, viable replacement for `@lit-labs/router`. Priorities: simple, fast, small, well-tested.

## Phases

### Phase 1: Cleanup & Route Params
- [x] Delete duplicate `src/nav-router.ts`
- [x] Extract route params via `URLPattern.exec()` and pass to render
- [x] Add `getCurrentParams()`, include params in `route-changed` event

### Phase 2: Plugin API Enhancement
- [x] Add `NavigationContext` interface
- [x] Enhance `beforeNavigation` with context + guard support (return false/string)
- [x] Add `afterNavigation` hook
- [x] Fix: cancel navigation on plugin error (was continuing)

### Phase 3: Missing Features
- [x] Add `destroy()` method (store listener refs, cleanup)
- [x] Add `getURL()` method (expose query/hash)
- [x] Verify wildcard/catch-all routes work (URLPattern `/*`)

### Phase 4: Test Coverage
- [x] Route params (render, events, getCurrentParams)
- [x] Plugin guards (cancel, redirect, context, ordering)
- [x] afterNavigation hook
- [x] Error events
- [x] destroy() cleanup
- [x] Wildcard routes
- [x] getURL()

### Verification
- [x] `npm test` passes (38/38)
- [x] `npm run build` succeeds (1.35 KB gzipped / 1.18 KB brotli)
- [x] `npm run size` under 5KB limit

## API Summary

### New exports
- `RouteParams` — `Record<string, string | undefined>`
- `NavigationContext<TRender>` — `{ route, params, url }`

### Changed interfaces
- `Route.render` — now receives `(params: RouteParams) => TRender`
- `RouterPlugin.beforeNavigation` — now receives `NavigationContext`, can return `false` (cancel) or `string` (redirect)
- `RouterPlugin.afterNavigation` — new hook, runs after DOM update

### New methods on Router
- `getCurrentParams()` — returns current route params
- `getURL()` — returns `{ pathname, search, hash, searchParams }` or null
- `destroy()` — removes listeners, resets state, allows re-init

### Bug fixes
- Plugin errors now cancel navigation (previously continued)
- `init()` no longer pre-sets `currentRoute` before guards run

### Code review fixes
- Fixed popstate handler: now detects param changes on the same route pattern (e.g. `/user/1` → `/user/2`)
- Fixed `context.url`: now reflects the destination URL, not the current URL during navigate intercept
- `getCurrentParams()` now returns a shallow copy to prevent external mutation of internal state
- Added global `afterEach` destroy in tests as a safety net for listener cleanup

### Redirect simplification
- Removed recursive `handleNavigation` redirect approach, `MAX_REDIRECTS`, and `redirectDepth`
- Redirects now call `this.navigate()` → `navigation.navigate()`, letting the platform handle URL updates, history, and loop prevention
- Smaller bundle: 1.35 KB gzipped / 1.18 KB brotli

## Known Issues
- **Guard cancel/redirect runs inside `event.intercept()` handler** — the Navigation API has already intercepted the navigation by the time a plugin returns `false` or a redirect string, which can leave the URL bar out of sync with router state. Fix likely involves running guard checks before calling `event.intercept()`, but this conflicts with async plugins (lazy loading, auth). Needs deeper investigation into Navigation API abort/revert behavior.

## Future Considerations
- Nested routes / outlets
- Route-level `enter` guard (like lit-labs/router) as sugar over plugins
- SSR / prerendering support
