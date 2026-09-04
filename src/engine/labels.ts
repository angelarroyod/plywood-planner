import type { Hardware } from './types.ts';

/**
 * Spanish display names for hardware types. Lives in the engine rather than in a
 * client because both the web app and the native app need the same words, and
 * the engine already owns the other user-facing copy (template names, validation
 * messages). Still no DOM/React here — it is only a lookup table.
 */
export const HARDWARE_LABELS: Record<Hardware['type'], string> = {
  confirmat: 'Tornillo confirmat',
  screw: 'Tornillo',
  dowel: 'Taquete',
};
