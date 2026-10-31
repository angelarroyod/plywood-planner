import type { Hardware, Step } from '../types.ts';

const BRACKET_INSET = 50; // mm from each side to an anti-tip bracket

/** Two brackets on the Tapa and the anchors that hold them to the wall; pass through `mergeHardware`. */
export const WALL_HARDWARE: Hardware[] = [
  { type: 'screw', size: '3.5x13', qty: 4 }, // brackets to the Tapa: 13 mm + a 2 mm bracket stays inside even 12 mm
  { type: 'bracket', size: '2" (50 mm)', qty: 2 },
  { type: 'wall-anchor', size: '1/4"', qty: 4 },
];

/**
 * Anti-tip step for a tall case, placed right after its back goes on. `name` is the piece
 * ("alacena", "clóset"); `feminine` picks "la/una … Párala/Llena" over "el/un … Páralo/Lleno".
 */
export function wallStep(name: string, feminine: boolean): Omit<Step, 'order'> {
  const [the, a, o] = feminine ? ['la', 'una', 'a'] : ['el', 'un', 'o'];
  return {
    title: `Fija ${the} ${name} al muro`,
    description:
      `Páral${o} pegad${o} al muro donde va a quedar. Atornilla 2 escuadras sobre la tapa, a ` +
      `${BRACKET_INSET} mm de cada lateral y contra el muro, con 2 tornillos 3.5×13 cada una. Marca los agujeros en ` +
      'el muro, barrena con broca de 1/4" (para concreto si el muro es de block o tabique), mete los taquetes y ' +
      'atornilla las pijas. Si el techo no deja espacio sobre la tapa, pon las escuadras por dentro, bajo la tapa. ' +
      `Llen${o}, ${a} ${name} puede voltearse: no te saltes este paso.`,
    panelRefs: ['top'],
  };
}
