# web-router

![Size: 1.32 kB](https://img.shields.io/badge/size-[32m[1m1.32%20kB[22m[39m%20[90mbrotlied[39m-brightgreen)

A lightweight, framework-agnostic router built on the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API).

## Features

- **Modern** - Built on the Navigation API for native browser navigation
- **View Transitions** - Automatic View Transitions API integration for smooth page animations
- **Lazy Loading** - Built-in plugin for code splitting and lazy route loading
- **Plugin System** - Extensible with global and per-route plugins
- **TypeScript** - Full TypeScript support with generic state typing

## Installation

```bash
npm install web-router
```

## Quick Start

```typescript
import { Router, type Route } from 'web-router';
import { lazy } from 'web-router/lazy';
import { html, type TemplateResult } from 'lit';

// Define your routes
const routes: Route<TemplateResult>[] = [
  {
    path: '/',
    title: 'Home',
    render: () => html`<home-page></home-page>`,
  },
  {
    path: '/about',
    title: 'About',
    plugins: [lazy(() => import('./pages/about.js'))],
    render: () => html`<about-page></about-page>`,
  },
  {
    path: '/user/:id',
    title: 'User Profile',
    plugins: [lazy(() => import('./pages/user.js'))],
    render: () => html`<user-page></user-page>`,
  },
];

// Create and initialize the router
const router = new Router({ routes });
await router.init();

// Listen for route changes
router.addEventListener('route-changed', (event) => {
  const { route } = event.detail;
  console.log('Navigated to:', route.path);
});
```

## API Reference

### Router

The main router class that extends `EventTarget`.

#### Constructor

```typescript
const router = new Router<TRender>({
  routes: Route<TRender>[],
  plugins?: RouterPlugin[]  // Global plugins run on every navigation
});
```

#### Methods

##### `init(): Promise<void>`

Initialize the router. Must be called before first render.

- Builds route patterns for matching
- Sets up Navigation API event listeners
- Runs plugins for the initial route

```typescript
await router.init();
```

##### `navigate<T>(path: string | URL, options?: { state?: T }): Promise<void>`

Programmatically navigate to a path.

```typescript
// Simple navigation
await router.navigate('/about');

// Navigation with state
await router.navigate('/user/123', {
  state: { user: userData, fromPage: 'home' },
});

// Navigation with URL object
await router.navigate(new URL('/search?q=test', location.origin));
```

##### `getNavigationState<T>(): T | undefined`

Get the current navigation state from the history entry.

```typescript
interface UserPageState {
  user: User;
  scrollPosition?: number;
}

const state = router.getNavigationState<UserPageState>();
if (state?.user) {
  // Use the passed user data immediately
  this.user = state.user;
}
```

##### `render(): TemplateResult | null`

Render the current route's template. Returns `null` if no route matches.

```typescript
// In a Lit component:
render() {
  return html`
    <header>...</header>
    <main>${router.render()}</main>
    <footer>...</footer>
  `;
}
```

##### `getCurrentRoute(): Route | null`

Get the current matched route object.

```typescript
const route = router.getCurrentRoute();
console.log('Current path:', route?.path);
```

#### Events

##### `route-changed`

Dispatched when navigation completes.

```typescript
router.addEventListener('route-changed', (event: CustomEvent) => {
  const { route } = event.detail;
  console.log('Now at:', route.path, 'Title:', route.title);
});
```

##### `error`

Dispatched when a plugin throws an error during navigation.

```typescript
router.addEventListener('error', (event: CustomEvent) => {
  const { error, plugin, route } = event.detail;
  console.error(`Plugin "${plugin.name}" failed on route ${route.path}:`, error);
});
```

### Types

#### Route

```typescript
interface Route<TRender = unknown> {
  /** URL path pattern (supports URLPattern syntax like `/user/:id`) */
  path: string;
  /** Document title to set when this route is active */
  title: string;
  /** Function that returns the template to render */
  render: () => TRender;
  /** Optional plugins to run before this route renders */
  plugins?: RouterPlugin[];
}
```

#### RouterPlugin

```typescript
interface RouterPlugin {
  /** Optional name for debugging */
  name?: string;
  /** Called before navigation completes */
  beforeNavigation?: () => void | Promise<unknown>;
}
```

#### RouterOptions

```typescript
interface RouterOptions<TRender = unknown> {
  /** Route definitions for the application */
  routes: Route<TRender>[];
  /** Global plugins that run on every navigation */
  plugins?: RouterPlugin[];
}
```

#### NavigationState

Base type for navigation state. Define your own interface for app-specific state:

```typescript
type NavigationState = Record<string, unknown>;

// Your app:
interface MyAppState {
  user?: User;
  scrollPosition?: number;
}

// Use with router methods:
router.navigate<MyAppState>('/user/123', { state: { user: myUser } });
const state = router.getNavigationState<MyAppState>();
```

### Plugins

#### `lazy(importFn)`

Built-in plugin for lazy loading route modules.

```typescript
import { lazy } from 'web-router/lazy';
import { html, type TemplateResult } from 'lit';

const routes: Route<TemplateResult>[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    plugins: [lazy(() => import('./pages/dashboard.js'))],
    render: () => html`<dashboard-page></dashboard-page>`,
  },
];
```

#### Custom Plugins

Create custom plugins for authentication, analytics, etc.:

```typescript
const authGuard: RouterPlugin = {
  name: 'auth-guard',
  beforeNavigation: async () => {
    if (!isAuthenticated()) {
      // Redirect or show login
      throw new Error('Not authenticated');
    }
  },
};

const analytics: RouterPlugin = {
  name: 'analytics',
  beforeNavigation: () => {
    trackPageView(window.location.pathname);
  },
};

// Use as global plugin
const router = new Router({
  routes,
  plugins: [analytics],
});

// Or per-route
const routes: Route[] = [
  {
    path: '/admin',
    title: 'Admin',
    plugins: [authGuard, lazy(() => import('./pages/admin.js'))],
    render: () => html`<admin-page></admin-page>`,
  },
];
```

## Integration with Lit

The router works seamlessly with Lit components:

```typescript
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { router } from './router.js';

@customElement('my-app')
export class MyApp extends LitElement {
  @state() private _route = router.getCurrentRoute();

  connectedCallback() {
    super.connectedCallback();
    router.addEventListener('route-changed', this._onRouteChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    router.removeEventListener('route-changed', this._onRouteChanged);
  }

  private _onRouteChanged = () => {
    this._route = router.getCurrentRoute();
    this.requestUpdate();
  };

  render() {
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main>${router.render()}</main>
    `;
  }
}
```

## URL Parameters

Access URL parameters using the standard `URLPattern` result:

```typescript
// Route: /user/:id/post/:postId
const url = new URL(window.location.href);
const pattern = new URLPattern({ pathname: '/user/:id/post/:postId' });
const match = pattern.exec(url);

if (match) {
  const { id, postId } = match.pathname.groups;
  console.log('User ID:', id, 'Post ID:', postId);
}
```

## View Transitions

The router automatically uses the View Transitions API when available. Style your transitions with CSS:

```css
/* Fade transition (default) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* Slide transition for specific elements */
.page {
  view-transition-name: page;
}

::view-transition-old(page) {
  animation: slide-out 0.3s ease-out;
}

::view-transition-new(page) {
  animation: slide-in 0.3s ease-out;
}
```

## Browser Support

| Browser | Support |
| ------- | ------- |
| Chrome  | 102+    |
| Edge    | 102+    |
| Firefox | 147+    |
| Safari  | 26.2+   |

## License

GPL-2
