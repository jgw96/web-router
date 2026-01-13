/**
 * Base navigation state type - extend this for app-specific state.
 *
 * @example
 * ```typescript
 * // Define your app's navigation state
 * interface MyAppState {
 *   user?: User;
 *   data?: SomeData;
 * }
 *
 * // Pass state during navigation
 * router.navigate('/user/123', { state: { user: myUser } });
 *
 * // Retrieve state in your component
 * const state = router.getNavigationState<MyAppState>();
 * ```
 */
export type NavigationState = Record<string, unknown>;

/**
 * Plugin interface for extending route behavior.
 * Plugins can run async code before navigation completes.
 */
export interface RouterPlugin {
  name?: string;
  beforeNavigation?: () => void | Promise<unknown>;
}

/**
 * Route configuration.
 * 
 * @typeParam TRender - The type returned by the render function (e.g., TemplateResult for Lit, HTMLElement for vanilla)
 * 
 * @example
 * ```typescript
 * // With Lit
 * import type { TemplateResult } from 'lit';
 * const route: Route<TemplateResult> = {
 *   path: '/',
 *   title: 'Home',
 *   render: () => html`<home-page></home-page>`
 * };
 * 
 * // With vanilla web components
 * const route: Route<HTMLElement> = {
 *   path: '/',
 *   title: 'Home',
 *   render: () => document.createElement('home-page')
 * };
 * ```
 */
export interface Route<TRender = unknown> {
  path: string;
  title: string;
  render: () => TRender;
  /** Plugins to run before navigation completes */
  plugins?: RouterPlugin[];
}

/**
 * Router configuration options
 * 
 * @typeParam TRender - The type returned by route render functions
 */
export interface RouterOptions<TRender = unknown> {
  /** Route definitions for the application */
  routes: Route<TRender>[];
  /** Global plugins to run on every navigation */
  plugins?: RouterPlugin[];
}

/**
 * Lightweight router built on the Navigation API.
 *
 * A modern, framework-agnostic router that leverages the Navigation API
 * for seamless SPA navigation. Includes automatic View Transitions API
 * integration for smooth page animations.
 *
 * @typeParam TRender - The type returned by route render functions
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
 *
 * @example
 * ```typescript
 * // With Lit
 * import { Router, type Route } from 'web-router';
 * import { html, type TemplateResult } from 'lit';
 *
 * const routes: Route<TemplateResult>[] = [
 *   { path: '/', title: 'Home', render: () => html`<home-page></home-page>` },
 *   { path: '/about', title: 'About', render: () => html`<about-page></about-page>` }
 * ];
 *
 * const router = new Router({ routes });
 * await router.init();
 * ```
 *
 * @example
 * ```typescript
 * // With vanilla web components
 * import { Router, type Route } from 'web-router';
 *
 * const routes: Route<HTMLElement>[] = [
 *   { path: '/', title: 'Home', render: () => document.createElement('home-page') },
 *   { path: '/about', title: 'About', render: () => document.createElement('about-page') }
 * ];
 *
 * const router = new Router({ routes });
 * await router.init();
 *
 * // Render into DOM on route change
 * router.addEventListener('route-changed', () => {
 *   const outlet = document.getElementById('outlet')!;
 *   outlet.innerHTML = '';
 *   const content = router.render();
 *   if (content) outlet.appendChild(content);
 * });
 * ```
 *
 * @fires route-changed - Dispatched when navigation completes with `{ detail: { route: Route } }`
 */
export class Router<TRender = unknown> extends EventTarget {
  private routes: Route<TRender>[];
  private patterns: Map<URLPattern, Route<TRender>> = new Map();
  private currentRoute: Route<TRender> | null = null;
  private initialized = false;
  private plugins: RouterPlugin[];

  constructor(options: RouterOptions<TRender>) {
    super();
    this.routes = options.routes;
    this.plugins = options.plugins ?? [];
  }

  private setupNavigationListeners(): void {
    window.navigation.addEventListener('navigate', (event) => {
      // Only handle same-origin navigations
      const url = new URL(event.destination.url);

      if (url.origin !== window.location.origin) {
        return;
      }

      // Don't intercept downloads or form submissions
      if (event.downloadRequest || event.formData) {
        return;
      }

      // Can't intercept this navigation (e.g., cross-origin)
      if (!event.canIntercept) {
        return;
      }

      const route = this.matchRoute(url.pathname);
      if (!route) {
        return; // Let the browser handle unknown routes
      }

      event.intercept({
        focusReset: 'manual',
        scroll: 'manual',
        handler: async () => {
          await this.handleNavigation(route);
        },
      });
    });

    // Handle popstate for back/forward that might not trigger navigate event
    window.addEventListener('popstate', () => {
      const route = this.matchRoute(window.location.pathname);
      if (route && route.path !== this.currentRoute?.path) {
        this.handleNavigation(route);
      }
    });
  }

  /**
   * Match a pathname to a route using URLPattern
   */
  private matchRoute(pathname: string): Route<TRender> | null {
    for (const [pattern, route] of this.patterns) {
      if (pattern.test({ pathname })) {
        return route;
      }
    }
    return null;
  }

  private async handleNavigation(
    route: Route<TRender>,
    options?: { skipViewTransition?: boolean }
  ): Promise<void> {
    // Run global plugins, then route-specific plugins
    const allPlugins = [...this.plugins, ...(route.plugins ?? [])];
    for (const plugin of allPlugins) {
      if (plugin.beforeNavigation) {
        try {
          await plugin.beforeNavigation();
        } catch (error) {
          this.dispatchEvent(
            new CustomEvent('error', { detail: { error, plugin, route } })
          );
        }
      }
    }

    // Update document title
    if (route.title) {
      document.title = route.title;
    }

    const updateDOM = () => {
      this.currentRoute = route;
      this.dispatchEvent(
        new CustomEvent('route-changed', { detail: { route } })
      );
    };

    // Skip view transition if requested (e.g., when closing a dialog that pushed history state)
    if (options?.skipViewTransition) {
      updateDOM();
      return;
    }

    if ('startViewTransition' in document) {
      try {
        const transition = (
          document as Document & {
            startViewTransition: (cb: () => void) => {
              ready: Promise<void>;
              finished: Promise<void>;
              updateCallbackDone: Promise<void>;
            };
          }
        ).startViewTransition(updateDOM);

        // Wait for animations to finish
        await transition.finished;
      } catch (e) {
        // If transition fails, just update DOM normally
        console.warn('View transition failed:', e);
        updateDOM();
      }
    } else {
      updateDOM();
    }
  }

  async navigate<T extends NavigationState = NavigationState>(
    path: string | URL,
    options?: { state?: T }
  ): Promise<void> {
    const url =
      typeof path === 'string' ? new URL(path, window.location.origin) : path;

    await window.navigation.navigate(url.href, {
      history: 'push',
      info: { viewTransition: true },
      state: options?.state,
    }).finished;
  }

  /**
   * Get the current navigation state from the current history entry.
   * Returns undefined if no state was passed during navigation.
   *
   * @typeParam T - The expected state type (defaults to NavigationState)
   * @returns The navigation state or undefined
   *
   * @example
   * ```typescript
   * interface UserPageState {
   *   user: User;
   *   scrollPosition?: number;
   * }
   *
   * // In your page component:
   * const state = router.getNavigationState<UserPageState>();
   * if (state?.user) {
   *   // Use the passed user data immediately
   *   this.user = state.user;
   * } else {
   *   // Fallback to fetching
   *   this.user = await fetchUser(this.userId);
   * }
   * ```
   */
  getNavigationState<T extends NavigationState = NavigationState>(): T | undefined {
    return window.navigation?.currentEntry?.getState() as T | undefined;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Build URLPattern matchers for each route
    for (const route of this.routes) {
      const pattern = new URLPattern({ pathname: route.path });
      this.patterns.set(pattern, route);
    }

    // Set initial route
    this.currentRoute = this.matchRoute(window.location.pathname);

    // Set up Navigation API listeners
    this.setupNavigationListeners();

    this.initialized = true;

    // Handle initial route
    if (this.currentRoute) {
      await this.handleNavigation(this.currentRoute);
    }
  }

  /**
   * Render the current route's template.
   *
   * @returns The result from the current route's render function,
   *          or null if no route matches.
   *
   * @example
   * ```typescript
   * // In a Lit component:
   * render() {
   *   return html`
   *     <header>...</header>
   *     <main>${router.render()}</main>
   *     <footer>...</footer>
   *   `;
   * }
   *
   * // With vanilla web components:
   * router.addEventListener('route-changed', () => {
   *   const outlet = document.getElementById('outlet')!;
   *   outlet.innerHTML = '';
   *   const content = router.render();
   *   if (content) outlet.appendChild(content);
   * });
   * ```
   */
  render(): TRender | null {
    if (!this.currentRoute) {
      return null;
    }
    return this.currentRoute.render();
  }

  getCurrentRoute(): Route<TRender> | null {
    return this.currentRoute;
  }
}
