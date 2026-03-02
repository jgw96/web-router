/**
 * Base navigation state type - extend this for app-specific state.
 *
 * @example
 * ```typescript
 * interface MyAppState {
 *   user?: User;
 *   data?: SomeData;
 * }
 *
 * router.navigate('/user/123', { state: { user: myUser } });
 * const state = router.getNavigationState<MyAppState>();
 * ```
 */
export type NavigationState = Record<string, unknown>;

/** Extracted URL parameters from the matched route pattern. */
export type RouteParams = Record<string, string | undefined>;

/** Context passed to plugin hooks during navigation. */
export interface NavigationContext {
  route: { path: string; title: string };
  params: RouteParams;
  url: URL;
}

/**
 * Plugin interface for extending route behavior.
 *
 * - `beforeNavigation` runs before the route change. Return `false` to cancel,
 *   or a string to redirect to that path.
 * - `afterNavigation` runs after the DOM update completes.
 */
export interface RouterPlugin {
  name?: string;
  beforeNavigation?: (
    context: NavigationContext
  ) => void | boolean | string | Promise<void | boolean | string>;
  afterNavigation?: (context: NavigationContext) => void | Promise<void>;
}

/**
 * Route configuration.
 *
 * @typeParam TRender - The type returned by the render function (e.g., TemplateResult for Lit, HTMLElement for vanilla)
 *
 * @example
 * ```typescript
 * // With Lit
 * const route: Route<TemplateResult> = {
 *   path: '/user/:id',
 *   title: 'User',
 *   render: (params) => html`<user-page .userId=${params.id}></user-page>`
 * };
 * ```
 */
export interface Route<TRender = unknown> {
  path: string;
  title: string;
  render: (params: RouteParams) => TRender;
  /** Plugins to run for this route */
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
 *   { path: '/user/:id', title: 'User', render: (params) => html`<user-page .userId=${params.id}></user-page>` }
 * ];
 *
 * const router = new Router({ routes });
 * await router.init();
 * ```
 *
 * @fires route-changed - Dispatched when navigation completes with `{ detail: { route, params } }`
 */
export class Router<TRender = unknown> extends EventTarget {
  private routes: Route<TRender>[];
  private patterns: Map<URLPattern, Route<TRender>> = new Map();
  private currentRoute: Route<TRender> | null = null;
  private currentParams: RouteParams = {};
  private currentPathname: string = '';
  private initialized = false;
  private plugins: RouterPlugin[];
  private navigateHandler: ((event: NavigateEvent) => void) | null = null;
  private popstateHandler: (() => void) | null = null;

  constructor(options: RouterOptions<TRender>) {
    super();
    this.routes = options.routes;
    this.plugins = options.plugins ?? [];
  }

  private setupNavigationListeners(): void {
    this.navigateHandler = (event) => {
      const url = new URL(event.destination.url);

      if (url.origin !== window.location.origin) return;
      if (event.downloadRequest || event.formData) return;
      if (!event.canIntercept) return;

      const match = this.matchRoute(url.pathname);
      if (!match) return;

      event.intercept({
        focusReset: 'manual',
        scroll: 'manual',
        handler: async () => {
          await this.handleNavigation(match.route, match.params, { url });
        },
      });
    };

    window.navigation.addEventListener('navigate', this.navigateHandler);

    this.popstateHandler = () => {
      const url = new URL(window.location.href);
      const match = this.matchRoute(url.pathname);
      if (match && this.hasRouteChanged(match, url)) {
        this.handleNavigation(match.route, match.params, { url });
      }
    };

    window.addEventListener('popstate', this.popstateHandler);
  }

  private hasRouteChanged(
    match: { route: Route<TRender>; params: RouteParams },
    url: URL
  ): boolean {
    if (match.route.path !== this.currentRoute?.path) return true;
    // Same route pattern but different URL (e.g. /user/1 vs /user/2)
    if (url.pathname !== this.currentPathname) return true;
    return false;
  }

  private matchRoute(
    pathname: string
  ): { route: Route<TRender>; params: RouteParams } | null {
    for (const [pattern, route] of this.patterns) {
      const result = pattern.exec({ pathname });
      if (result) {
        return { route, params: result.pathname.groups };
      }
    }
    return null;
  }

  private async handleNavigation(
    route: Route<TRender>,
    params: RouteParams,
    options?: { skipViewTransition?: boolean; url?: URL }
  ): Promise<void> {
    const context: NavigationContext = {
      route: { path: route.path, title: route.title },
      params,
      url: options?.url ?? new URL(window.location.href),
    };

    // Run global plugins, then route-specific plugins
    const allPlugins = [...this.plugins, ...(route.plugins ?? [])];
    for (const plugin of allPlugins) {
      if (plugin.beforeNavigation) {
        try {
          const result = await plugin.beforeNavigation(context);
          if (result === false) return;
          if (typeof result === 'string') {
            await this.navigate(result);
            return;
          }
        } catch (error) {
          this.dispatchEvent(
            new CustomEvent('error', { detail: { error, plugin, route } })
          );
          return;
        }
      }
    }

    if (route.title) {
      document.title = route.title;
    }

    const updateDOM = () => {
      this.currentRoute = route;
      this.currentParams = params;
      this.currentPathname = context.url.pathname;
      this.dispatchEvent(
        new CustomEvent('route-changed', { detail: { route, params } })
      );
    };

    if (options?.skipViewTransition) {
      updateDOM();
    } else if ('startViewTransition' in document) {
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
        await transition.finished;
      } catch {
        updateDOM();
      }
    } else {
      updateDOM();
    }

    // Run afterNavigation hooks
    for (const plugin of allPlugins) {
      if (plugin.afterNavigation) {
        try {
          await plugin.afterNavigation(context);
        } catch (error) {
          this.dispatchEvent(
            new CustomEvent('error', { detail: { error, plugin, route } })
          );
        }
      }
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

  getNavigationState<T extends NavigationState = NavigationState>():
    | T
    | undefined {
    return window.navigation?.currentEntry?.getState() as T | undefined;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    for (const route of this.routes) {
      const pattern = new URLPattern({ pathname: route.path });
      this.patterns.set(pattern, route);
    }

    this.setupNavigationListeners();
    this.initialized = true;

    // Handle initial route
    const url = new URL(window.location.href);
    const match = this.matchRoute(url.pathname);
    if (match) {
      await this.handleNavigation(match.route, match.params, { url });
    }
  }

  render(): TRender | null {
    if (!this.currentRoute) return null;
    return this.currentRoute.render(this.currentParams);
  }

  getCurrentRoute(): Route<TRender> | null {
    return this.currentRoute;
  }

  getCurrentParams(): RouteParams {
    return { ...this.currentParams };
  }

  getURL(): {
    pathname: string;
    search: string;
    hash: string;
    searchParams: URLSearchParams;
  } | null {
    if (!this.currentRoute) return null;
    const url = new URL(window.location.href);
    return {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      searchParams: url.searchParams,
    };
  }

  destroy(): void {
    if (this.navigateHandler) {
      window.navigation.removeEventListener('navigate', this.navigateHandler);
      this.navigateHandler = null;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    this.currentRoute = null;
    this.currentParams = {};
    this.currentPathname = '';
    this.patterns.clear();
    this.initialized = false;
  }
}

/**
 * Creates a lazy loading plugin that dynamically imports a module
 * before the route renders.
 */
export function lazy(importFn: () => Promise<unknown>): RouterPlugin {
  return {
    name: 'lazy',
    beforeNavigation: async () => {
      await importFn();
    },
  };
}
