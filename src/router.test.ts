import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router, type Route, type RouterPlugin } from './web-router';

describe('Router', () => {
  let router: Router<string>;
  let originalPathname: string;

  const createTestRoutes = (): Route<string>[] => [
    {
      path: '/',
      title: 'Home',
      render: () => '<div>Home</div>',
    },
    {
      path: '/about',
      title: 'About',
      render: () => '<div>About</div>',
    },
    {
      path: '/user/:id',
      title: 'User Profile',
      render: (params) => `<div>User ${params.id}</div>`,
    },
    {
      path: '/post/:id/comment/:commentId',
      title: 'Comment',
      render: (params) =>
        `<div>Post ${params.id} Comment ${params.commentId}</div>`,
    },
  ];

  const navigateToPath = (path: string) => {
    history.pushState({}, '', path);
  };

  beforeEach(() => {
    originalPathname = window.location.pathname;
    history.pushState({}, '', '/');
  });

  afterEach(() => {
    router?.destroy();
    vi.clearAllMocks();
    history.pushState({}, '', originalPathname);
  });

  describe('constructor', () => {
    it('should create a router with routes', () => {
      router = new Router({ routes: createTestRoutes() });
      expect(router).toBeInstanceOf(Router);
    });
  });

  describe('init', () => {
    it('should initialize the router and set up listeners', async () => {
      router = new Router({ routes: createTestRoutes() });
      const addEventListenerSpy = vi.spyOn(
        window.navigation,
        'addEventListener'
      );
      await router.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function)
      );
      addEventListenerSpy.mockRestore();
      router.destroy();
    });

    it('should only initialize once', async () => {
      router = new Router({ routes: createTestRoutes() });
      const addEventListenerSpy = vi.spyOn(
        window.navigation,
        'addEventListener'
      );
      await router.init();
      await router.init();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      addEventListenerSpy.mockRestore();
      router.destroy();
    });

    it('should set initial route based on current pathname', async () => {
      navigateToPath('/about');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe('<div>About</div>');
      router.destroy();
    });

    it('should dispatch route-changed event on init', async () => {
      router = new Router({ routes: createTestRoutes() });
      const routeChangedHandler = vi.fn();
      router.addEventListener('route-changed', routeChangedHandler);

      await router.init();

      expect(routeChangedHandler).toHaveBeenCalled();
      router.destroy();
    });
  });

  describe('route matching', () => {
    it('should match static routes', async () => {
      navigateToPath('/about');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe('<div>About</div>');
      router.destroy();
    });

    it('should match routes with single parameter', async () => {
      navigateToPath('/user/123');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe('<div>User 123</div>');
      router.destroy();
    });

    it('should match routes with multiple parameters', async () => {
      navigateToPath('/post/456/comment/789');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe(
        '<div>Post 456 Comment 789</div>'
      );
      router.destroy();
    });

    it('should return null for unmatched routes', async () => {
      navigateToPath('/nonexistent');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBeNull();
      router.destroy();
    });
  });

  describe('route params', () => {
    it('should pass params to the render function', async () => {
      navigateToPath('/user/42');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe('<div>User 42</div>');
      router.destroy();
    });

    it('should return current params via getCurrentParams()', async () => {
      navigateToPath('/user/42');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const params = router.getCurrentParams();
      expect(params.id).toBe('42');
      router.destroy();
    });

    it('should include params in route-changed event detail', async () => {
      navigateToPath('/user/99');

      router = new Router({ routes: createTestRoutes() });
      const handler = vi.fn();
      router.addEventListener('route-changed', handler);

      await router.init();

      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.params.id).toBe('99');
      router.destroy();
    });

    it('should return empty params for static routes', async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const params = router.getCurrentParams();
      expect(Object.keys(params).length).toBe(0);
      router.destroy();
    });

    it('should extract multiple params', async () => {
      navigateToPath('/post/10/comment/20');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const params = router.getCurrentParams();
      expect(params.id).toBe('10');
      expect(params.commentId).toBe('20');
      router.destroy();
    });

    it('should return a copy from getCurrentParams that cannot mutate internal state', async () => {
      navigateToPath('/user/42');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const params = router.getCurrentParams();
      params.id = 'mutated';

      // Internal state should be unaffected
      expect(router.getCurrentParams().id).toBe('42');
      router.destroy();
    });
  });

  describe('navigate', () => {
    let navigateMock: ReturnType<typeof vi.fn>;
    let originalNavigate: typeof window.navigation.navigate;

    beforeEach(async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();

      originalNavigate = window.navigation.navigate.bind(window.navigation);
      navigateMock = vi.fn().mockReturnValue({ finished: Promise.resolve() });
      window.navigation.navigate =
        navigateMock as typeof window.navigation.navigate;
    });

    afterEach(() => {
      window.navigation.navigate = originalNavigate;
      router.destroy();
    });

    it('should call Navigation API navigate', async () => {
      await router.navigate('/about');

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining('/about'),
        expect.objectContaining({ history: 'push' })
      );
    });

    it('should handle URL objects', async () => {
      const url = new URL('/about', window.location.origin);
      await router.navigate(url);

      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining('/about'),
        expect.any(Object)
      );
    });
  });

  describe('render', () => {
    it('should return null when no route matches', async () => {
      navigateToPath('/unknown-route');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBeNull();
      router.destroy();
    });

    it('should return correct template for matched route', async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe('<div>Home</div>');
      router.destroy();
    });
  });

  describe('document title', () => {
    it('should update document title on navigation', async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(document.title).toBe('Home');
      router.destroy();
    });
  });

  describe('EventTarget', () => {
    it('should extend EventTarget', () => {
      router = new Router({ routes: createTestRoutes() });
      expect(router).toBeInstanceOf(EventTarget);
    });

    it('should dispatch route-changed events with route and params', async () => {
      navigateToPath('/user/5');

      router = new Router({ routes: createTestRoutes() });
      const handler = vi.fn();
      router.addEventListener('route-changed', handler);

      await router.init();

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.route.path).toBe('/user/:id');
      expect(event.detail.params.id).toBe('5');
      router.destroy();
    });
  });

  describe('plugins', () => {
    it('should run global plugins before route plugins', async () => {
      const order: string[] = [];

      const globalPlugin: RouterPlugin = {
        name: 'global',
        beforeNavigation: async () => {
          order.push('global');
        },
      };

      const routePlugin: RouterPlugin = {
        name: 'route',
        beforeNavigation: async () => {
          order.push('route');
        },
      };

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
          plugins: [routePlugin],
        },
      ];

      router = new Router({ routes, plugins: [globalPlugin] });
      await router.init();

      expect(order).toEqual(['global', 'route']);
      router.destroy();
    });

    it('should pass NavigationContext to beforeNavigation', async () => {
      navigateToPath('/user/77');

      const plugin: RouterPlugin = {
        name: 'test',
        beforeNavigation: vi.fn(),
      };

      router = new Router({
        routes: createTestRoutes(),
        plugins: [plugin],
      });
      await router.init();

      const ctx = (plugin.beforeNavigation as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(ctx.route.path).toBe('/user/:id');
      expect(ctx.params.id).toBe('77');
      expect(ctx.url).toBeInstanceOf(URL);
      expect(ctx.url.pathname).toBe('/user/77');
      router.destroy();
    });

    it('should cancel navigation when beforeNavigation returns false', async () => {
      const guardPlugin: RouterPlugin = {
        name: 'guard',
        beforeNavigation: async () => false,
      };

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
        },
        {
          path: '/protected',
          title: 'Protected',
          render: () => '<div>Protected</div>',
          plugins: [guardPlugin],
        },
      ];

      navigateToPath('/protected');
      router = new Router({ routes });
      await router.init();

      expect(router.render()).toBeNull();
      router.destroy();
    });

    it('should redirect when beforeNavigation returns a string', async () => {
      const originalNavigate = window.navigation.navigate.bind(
        window.navigation
      );
      const navigateMock = vi
        .fn()
        .mockReturnValue({ finished: Promise.resolve() });

      const redirectPlugin: RouterPlugin = {
        name: 'redirect',
        beforeNavigation: async (ctx) => {
          if (ctx.route.path === '/old') return '/about';
        },
      };

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
        },
        {
          path: '/old',
          title: 'Old',
          render: () => '<div>Old</div>',
          plugins: [redirectPlugin],
        },
        {
          path: '/about',
          title: 'About',
          render: () => '<div>About</div>',
        },
      ];

      navigateToPath('/old');
      router = new Router({ routes });

      // Mock navigate to capture the redirect
      window.navigation.navigate =
        navigateMock as typeof window.navigation.navigate;

      await router.init();

      // Redirect should have called navigate with /about
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining('/about'),
        expect.objectContaining({ history: 'push' })
      );

      window.navigation.navigate = originalNavigate;
      router.destroy();
    });

    it('should cancel navigation and dispatch error event when plugin throws', async () => {
      const error = new Error('plugin failed');
      const errorPlugin: RouterPlugin = {
        name: 'failing',
        beforeNavigation: async () => {
          throw error;
        },
      };

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
          plugins: [errorPlugin],
        },
      ];

      router = new Router({ routes });
      const errorHandler = vi.fn();
      router.addEventListener('error', errorHandler);

      await router.init();

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.error).toBe(error);
      expect(event.detail.plugin.name).toBe('failing');
      // Navigation was cancelled on error
      expect(router.render()).toBeNull();
      router.destroy();
    });

    it('should run afterNavigation hooks after DOM update', async () => {
      const order: string[] = [];

      const plugin: RouterPlugin = {
        name: 'lifecycle',
        beforeNavigation: async () => {
          order.push('before');
        },
        afterNavigation: async () => {
          order.push('after');
        },
      };

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
        },
      ];

      router = new Router({ routes, plugins: [plugin] });

      // Listen for route-changed to track DOM update timing
      router.addEventListener('route-changed', () => {
        order.push('dom-update');
      });

      await router.init();

      expect(order).toEqual(['before', 'dom-update', 'after']);
      router.destroy();
    });

    it('should dispatch error event when afterNavigation throws', async () => {
      const error = new Error('after failed');
      const plugin: RouterPlugin = {
        name: 'after-fail',
        afterNavigation: async () => {
          throw error;
        },
      };

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
          plugins: [plugin],
        },
      ];

      router = new Router({ routes });
      const errorHandler = vi.fn();
      router.addEventListener('error', errorHandler);

      await router.init();

      // Route should still be set (afterNavigation errors don't cancel)
      expect(router.render()).toBe('<div>Home</div>');
      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.error).toBe(error);
      router.destroy();
    });
  });

  describe('destroy', () => {
    it('should remove event listeners', async () => {
      router = new Router({ routes: createTestRoutes() });
      const removeSpy = vi.spyOn(
        window.navigation,
        'removeEventListener'
      );

      await router.init();
      router.destroy();

      expect(removeSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function)
      );
      removeSpy.mockRestore();
    });

    it('should reset state after destroy', async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.render()).toBe('<div>Home</div>');

      router.destroy();

      expect(router.render()).toBeNull();
      expect(router.getCurrentRoute()).toBeNull();
      expect(Object.keys(router.getCurrentParams())).toHaveLength(0);
    });

    it('should allow re-initialization after destroy', async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();
      router.destroy();

      await router.init();
      expect(router.render()).toBe('<div>Home</div>');
      router.destroy();
    });
  });

  describe('getURL', () => {
    it('should return null when no route matches', async () => {
      navigateToPath('/nonexistent');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      expect(router.getURL()).toBeNull();
      router.destroy();
    });

    it('should return pathname for matched route', async () => {
      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const urlInfo = router.getURL();
      expect(urlInfo).not.toBeNull();
      expect(urlInfo!.pathname).toBe('/');
      router.destroy();
    });

    it('should return search params', async () => {
      navigateToPath('/about?foo=bar&baz=1');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const urlInfo = router.getURL();
      expect(urlInfo).not.toBeNull();
      expect(urlInfo!.search).toBe('?foo=bar&baz=1');
      expect(urlInfo!.searchParams.get('foo')).toBe('bar');
      expect(urlInfo!.searchParams.get('baz')).toBe('1');
      router.destroy();
    });

    it('should return hash', async () => {
      navigateToPath('/about#section');

      router = new Router({ routes: createTestRoutes() });
      await router.init();

      const urlInfo = router.getURL();
      expect(urlInfo).not.toBeNull();
      expect(urlInfo!.hash).toBe('#section');
      router.destroy();
    });
  });

  describe('wildcard routes', () => {
    it('should match a catch-all wildcard route', async () => {
      navigateToPath('/anything/here');

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
        },
        {
          path: '/*',
          title: 'Not Found',
          render: () => '<div>404</div>',
        },
      ];

      router = new Router({ routes });
      await router.init();

      expect(router.render()).toBe('<div>404</div>');
      router.destroy();
    });

    it('should prefer specific routes over wildcard', async () => {
      navigateToPath('/about');

      const routes: Route<string>[] = [
        {
          path: '/',
          title: 'Home',
          render: () => '<div>Home</div>',
        },
        {
          path: '/about',
          title: 'About',
          render: () => '<div>About</div>',
        },
        {
          path: '/*',
          title: 'Not Found',
          render: () => '<div>404</div>',
        },
      ];

      router = new Router({ routes });
      await router.init();

      expect(router.render()).toBe('<div>About</div>');
      router.destroy();
    });
  });
});
