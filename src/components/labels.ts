import type { Hardware } from '../engine/types.ts';

export const HARDWARE_LABELS: Record<Hardware['type'], string> = {
  confirmat: 'Tornillo confirmat',
  screw: 'Tornillo',
  dowel: 'Taquete',
};
