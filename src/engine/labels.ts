import type { Design, Hardware } from './types.ts';

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
  hinge: 'Bisagra de cazoleta',
  handle: 'Jaladera',
  rod: 'Tubo oval para clóset',
  'rod-support': 'Soporte de tubo',
};

/** One hardware line without its quantity, e.g. 'Tubo oval para clóset 15×30 mm, cortado a 762 mm'. */
export function hardwareText(h: Hardware): string {
  const text = `${HARDWARE_LABELS[h.type]} ${h.size}`;
  return h.cutTo === undefined ? text : `${text}, cortado a ${h.cutTo} mm`;
}

/** A label for every id a step may reference: panels and fittings, with the panel winning on a shared id. */
export function refLabels(design: Design): Record<string, string> {
  return Object.fromEntries([...design.fittings, ...design.panels].map((p) => [p.id, p.label]));
}
