// URLPattern is available in modern browsers but not yet in TypeScript's lib
// https://developer.mozilla.org/en-US/docs/Web/API/URLPattern

interface URLPatternInit {
  baseURL?: string;
  username?: string;
  password?: string;
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
}

interface URLPatternResult {
  inputs: [URLPatternInit] | [URLPatternInit, string];
  protocol: URLPatternComponentResult;
  username: URLPatternComponentResult;
  password: URLPatternComponentResult;
  hostname: URLPatternComponentResult;
  port: URLPatternComponentResult;
  pathname: URLPatternComponentResult;
  search: URLPatternComponentResult;
  hash: URLPatternComponentResult;
}

interface URLPatternComponentResult {
  input: string;
  groups: Record<string, string | undefined>;
}

declare class URLPattern {
  constructor(init?: URLPatternInit, baseURL?: string);
  constructor(pattern: string, baseURL?: string);

  test(input?: URLPatternInit | string, baseURL?: string): boolean;
  exec(input?: URLPatternInit | string, baseURL?: string): URLPatternResult | null;

  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}
