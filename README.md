# web-router

![Size: 1.35 kB](https://img.shields.io/badge/size-1.24%20kB-brightgreen)

A tiny, modern client-side router built on the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) and [URL Pattern API](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API). Designed for web components, works with anything.

**AI used for code cleanup, code review etc. All code is human tested and reviewed**

## Features

- **~1.5 kB gzipped** — minimal footprint, zero runtime dependencies
- **Navigation API** — built on the platform, not a polyfill
- **URL Pattern API** — standard route matching with `:param` syntax
- **View Transitions** — automatic integration for smooth page animations
- **Route Params** — extracted and passed directly to your render function
- **Plugin System** — guards, lazy loading, analytics, and more
- **TypeScript** — fully typed with generic render output

## Installation

```bash
npm install web-router
```

## Quick Start

### With Lit

```typescript
import { Router, type Route } from 'web-router';
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { TemplateResult } from 'lit';

const routes: Route<TemplateResult>[] = [
  {
    path: '/',
    title: 'Home',
    render: () => html`<home-page></home-page>`,
  },
  {
    path: '/user/:id',
    title: 'User Profile',
    render: (params) => html`<user-page .userId=${params.id}></user-page>`,
  },
];

const router = new Router({ routes });

@customElement('my-app')
export class MyApp extends LitElement {
  @state() private _route = router.getCurrentRoute();

  async connectedCallback() {
    super.connectedCallback();
    router.addEventListener('route-changed', this._onRouteChanged);
    await router.init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    router.removeEventListener('route-changed', this._onRouteChanged);
    router.destroy();
  }

  private _onRouteChanged = () => {
    this._route = router.getCurrentRoute();
    this.requestUpdate();
  };

  render() {
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/user/42">User 42</a>
      </nav>
      <main>${router.render()}</main>
    `;
  }
}
```

### With Vanilla Web Components

```typescript
import { Router, type Route } from 'web-router';

const routes: Route<HTMLElement>[] = [
  {
    path: '/',
    title: 'Home',
    render: () => document.createElement('home-page'),
  },
  {
    path: '/about',
    title: 'About',
    render: () => document.createElement('about-page'),
  },
];

const router = new Router({ routes });

router.addEventListener('route-changed', () => {
  const outlet = document.getElementById('outlet')!;
  outlet.innerHTML = '';
  const content = router.render();
  if (content) outlet.appendChild(content);
});

await router.init();
```

## Route Params

Route paths use [URL Pattern](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API) syntax. Params are extracted automatically and passed to your `render` function.

```typescript
const routes: Route<TemplateResult>[] = [
  {
    // Static route — no params
    path: '/about',
    title: 'About',
    render: () => html`<about-page></about-page>`,
  },
  {
    // Single param
    path: '/user/:id',
    title: 'User',
    render: (params) => html`<user-page .userId=${params.id}></user-page>`,
  },
  {
    // Multiple params
    path: '/post/:postId/comment/:commentId',
    title: 'Comment',
    render: (params) => html`
      <comment-page
        .postId=${params.postId}
        .commentId=${params.commentId}
      ></comment-page>
    `,
  },
];
```

You can also access params programmatically:

```typescript
const params = router.getCurrentParams();
console.log(params.id); // "42"
```

## Plugins

Plugins hook into the navigation lifecycle. They can run before and after navigation, cancel navigation, or redirect.

### Lazy Loading

The built-in `lazy` plugin loads modules on demand:

```typescript
import { lazy } from 'web-router/lazy';

const routes: Route<TemplateResult>[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    plugins: [lazy(() => import('./pages/dashboard.js'))],
    render: () => html`<dashboard-page></dashboard-page>`,
  },
];
```

### Guards

Return `false` from `beforeNavigation` to cancel navigation:

```typescript
const authGuard: RouterPlugin = {
  name: 'auth',
  beforeNavigation: async (ctx) => {
    if (ctx.route.path === '/admin' && !isAuthenticated()) {
      return false; // cancel — user stays on current page
    }
  },
};

const router = new Router({
  routes,
  plugins: [authGuard], // runs on every route
});
```

### Redirects

Return a path string from `beforeNavigation` to redirect:

```typescript
const redirectPlugin: RouterPlugin = {
  name: 'redirect',
  beforeNavigation: async (ctx) => {
    if (ctx.route.path === '/admin' && !isAuthenticated()) {
      return '/login'; // redirect to login page
    }
  },
};
```

Redirects go through the Navigation API — the browser updates the URL, manages history, and handles loop prevention natively.

### Analytics

Use `afterNavigation` to run code after the page has rendered:

```typescript
const analytics: RouterPlugin = {
  name: 'analytics',
  afterNavigation: (ctx) => {
    trackPageView(ctx.url.pathname, ctx.params);
  },
};
```

### Plugin Context

Both `beforeNavigation` and `afterNavigation` receive a `NavigationContext`:

```typescript
interface NavigationContext<TRender = unknown> {
  route: Route<TRender>;    // the matched route config
  params: RouteParams;       // extracted URL params
  url: URL;                  // the destination URL
}
```

### Global vs Per-Route Plugins

Global plugins run on every navigation. Per-route plugins run only for that route. Global plugins always run first.

```typescript
const router = new Router({
  routes: [
    {
      path: '/admin',
      title: 'Admin',
      plugins: [authGuard, lazy(() => import('./pages/admin.js'))],
      render: (params) => html`<admin-page></admin-page>`,
    },
  ],
  plugins: [analytics], // runs on every navigation
});
```

## Error Handling

Plugin errors are caught and emitted as `error` events. If a `beforeNavigation` plugin throws, navigation is cancelled.

```typescript
router.addEventListener('error', (event: CustomEvent) => {
  const { error, plugin, route } = event.detail;
  console.error(`Plugin "${plugin.name}" failed on ${route.path}:`, error);
});
```

## Navigation State

Pass arbitrary state during navigation and retrieve it later:

```typescript
// Navigate with state
await router.navigate('/user/123', {
  state: { user: userData, fromPage: 'search' },
});

// Retrieve state in your component
interface UserPageState {
  user: User;
  fromPage: string;
}

const state = router.getNavigationState<UserPageState>();
if (state?.user) {
  this.user = state.user; // skip the fetch
}
```

## Query Strings and Hash

Use `getURL()` to access query parameters and hash:

```typescript
// URL: /search?q=router&page=2#results

const urlInfo = router.getURL();
urlInfo.pathname;                  // "/search"
urlInfo.search;                    // "?q=router&page=2"
urlInfo.searchParams.get('q');     // "router"
urlInfo.searchParams.get('page');  // "2"
urlInfo.hash;                      // "#results"
```

## Wildcard / 404 Routes

Use `/*` as a catch-all. Place it last — routes are matched in definition order.

```typescript
const routes: Route<TemplateResult>[] = [
  { path: '/', title: 'Home', render: () => html`<home-page></home-page>` },
  { path: '/about', title: 'About', render: () => html`<about-page></about-page>` },
  // Catch-all — must be last
  { path: '/*', title: 'Not Found', render: () => html`<not-found-page></not-found-page>` },
];
```

## View Transitions

The router automatically uses the [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) when available. No configuration needed — just add CSS:

```css
/* Crossfade (default behavior) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.25s;
}

/* Slide transition for a specific element */
.page-content {
  view-transition-name: page;
}

::view-transition-old(page) {
  animation: 0.25s ease-out slide-to-left;
}

::view-transition-new(page) {
  animation: 0.25s ease-out slide-from-right;
}

@keyframes slide-to-left {
  to { transform: translateX(-100%); }
}

@keyframes slide-from-right {
  from { transform: translateX(100%); }
}
```

## Cleanup

Call `destroy()` to remove all event listeners and reset state. The router can be re-initialized after destruction.

```typescript
router.destroy();

// Later, if needed:
await router.init();
```

## API Reference

### `Router<TRender>`

Extends `EventTarget`.

#### Constructor

```typescript
new Router<TRender>(options: RouterOptions<TRender>)
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `init()` | `Promise<void>` | Initialize the router, set up listeners, handle initial route |
| `navigate(path, options?)` | `Promise<void>` | Navigate to a path, optionally with state |
| `render()` | `TRender \| null` | Render the current route, or `null` if no match |
| `getCurrentRoute()` | `Route<TRender> \| null` | Get the current matched route config |
| `getCurrentParams()` | `RouteParams` | Get the current extracted URL params |
| `getURL()` | `{ pathname, search, hash, searchParams } \| null` | Get parsed URL info |
| `getNavigationState<T>()` | `T \| undefined` | Get state from the current history entry |
| `destroy()` | `void` | Remove listeners, clear state, allow re-init |

#### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `route-changed` | `{ route, params }` | Fired after navigation completes and DOM updates |
| `error` | `{ error, plugin, route }` | Fired when a plugin throws |

### `Route<TRender>`

```typescript
interface Route<TRender = unknown> {
  path: string;                          // URL pattern (e.g. "/user/:id")
  title: string;                         // document.title on match
  render: (params: RouteParams) => TRender;  // render function
  plugins?: RouterPlugin<TRender>[];     // per-route plugins
}
```

### `RouterPlugin<TRender>`

```typescript
interface RouterPlugin<TRender = unknown> {
  name?: string;
  beforeNavigation?: (ctx: NavigationContext<TRender>) =>
    void | boolean | string | Promise<void | boolean | string>;
  afterNavigation?: (ctx: NavigationContext<TRender>) =>
    void | Promise<void>;
}
```

**`beforeNavigation` return values:**
- `void` or `true` — continue navigation
- `false` — cancel navigation
- `string` — redirect to that path

### `NavigationContext<TRender>`

```typescript
interface NavigationContext<TRender = unknown> {
  route: Route<TRender>;                          // matched route
  params: Record<string, string | undefined>;      // URL params
  url: URL;                                        // destination URL
}
```

### `RouteParams`

```typescript
type RouteParams = Record<string, string | undefined>;
```

### `lazy(importFn)`

```typescript
import { lazy } from 'web-router/lazy';

lazy(() => import('./pages/my-page.js')): RouterPlugin
```

## Browser Support

Requires the [Navigation API](https://caniuse.com/mdn-api_navigation) and [URL Pattern API](https://caniuse.com/mdn-api_urlpattern).

| Browser | Version |
|---------|---------|
| Chrome  | 102+    |
| Edge    | 102+    |
| Firefox | 147+    |
| Safari  | 26.2+   |

## Coming from @lit-labs/router

This router can serve as a replacement for `@lit-labs/router`. Key differences:

| Feature | @lit-labs/router | web-router |
|---------|-----------------|------------|
| API style | Reactive controller | Standalone class + events |
| Route params | Via URLPattern result | Passed directly to `render(params)` |
| Navigation guards | `enter()` callback returning `boolean` | Plugin `beforeNavigation` returning `false` or redirect string |
| Lazy loading | Manual in `enter()` | Built-in `lazy()` plugin |
| Outlet | `outlet()` method | `render()` method |
| View Transitions | Not built-in | Automatic |
| Lifecycle hooks | None | `beforeNavigation` + `afterNavigation` |
| Cleanup | Tied to component lifecycle | Explicit `destroy()` |

### Migration example

```typescript
// @lit-labs/router
import { Router } from '@lit-labs/router';

class MyApp extends LitElement {
  private router = new Router(this, [
    { path: '/', render: () => html`<home-page></home-page>` },
    {
      path: '/user/:id',
      enter: async (params) => {
        await import('./pages/user.js');
        return true;
      },
      render: ({ id }) => html`<user-page .userId=${id}></user-page>`,
    },
  ]);

  render() {
    return html`${this.router.outlet()}`;
  }
}

// web-router
import { Router, type Route } from 'web-router';
import { lazy } from 'web-router/lazy';

const routes: Route<TemplateResult>[] = [
  { path: '/', title: 'Home', render: () => html`<home-page></home-page>` },
  {
    path: '/user/:id',
    title: 'User',
    plugins: [lazy(() => import('./pages/user.js'))],
    render: (params) => html`<user-page .userId=${params.id}></user-page>`,
  },
];

const router = new Router({ routes });

class MyApp extends LitElement {
  // ... (see Quick Start above for full example)
  render() {
    return html`${router.render()}`;
  }
}
```

## License

GPL-2
