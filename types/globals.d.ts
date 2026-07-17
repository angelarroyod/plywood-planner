// ponytail: minimal console declaration instead of @types/node — only the demo
// script and one test log anything. Add @types/node when scripts need more.
declare const console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
