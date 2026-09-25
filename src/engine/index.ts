export * from './types.ts';
export * from './validation.ts';
export * from './nesting.ts';
export * from './ascii.ts';
export * from './labels.ts';
export * from './stock.ts';
export * from './edge-banding.ts';
export * from './cuts.ts';
export * from './order.ts';
export * from './cost.ts';
export * from './parts/door.ts';
export { bookshelf, generateBookshelf } from './templates/bookshelf.ts';
export { sideTable, generateSideTable } from './templates/side-table.ts';

import type { Template } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';
import { sideTable } from './templates/side-table.ts';

export const templates: Template[] = [bookshelf, sideTable];
