/**
 * The one place the mobile app reaches into the web repo's engine.
 *
 * `src/engine/` is pure TypeScript with zero React/DOM/three imports precisely
 * so it could be lifted into React Native unchanged — this re-export is that
 * promise being cashed in. Metro watches the folder (see metro.config.js), so
 * editing the engine hot-reloads both clients. Keep this file a re-export only:
 * if the path ever moves, this is the single line to fix.
 */
export * from '../../../src/engine/index';
