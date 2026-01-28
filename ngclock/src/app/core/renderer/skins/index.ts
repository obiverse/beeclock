/**
 * Skin Registry: All available clock skins.
 *
 * Each skin is a pure rendering function.
 * Add new skins here to make them available system-wide.
 */

import { SkinRegistry } from '../clock-skin';
import { AnalogClassicSkin } from './analog-classic';
import { DigitalLEDSkin } from './digital-led';
import { MinimalistSkin } from './minimalist';
import { NeonSkin } from './neon';
import { GenerativeSkin } from './generative';
import { ConwaySkin } from './conway';

// Re-export all skins for direct access
export { AnalogClassicSkin } from './analog-classic';
export { DigitalLEDSkin } from './digital-led';
export { MinimalistSkin } from './minimalist';
export { NeonSkin } from './neon';
export { GenerativeSkin } from './generative';
export { ConwaySkin, resetConway, getGeneration, isAlive } from './conway';

/**
 * All available skins as an array.
 * Order matters for UI lists.
 */
export const ALL_SKINS = [
  AnalogClassicSkin,
  DigitalLEDSkin,
  MinimalistSkin,
  NeonSkin,
  GenerativeSkin,
  ConwaySkin,
] as const;

/**
 * Create a pre-populated skin registry.
 */
export function createSkinRegistry(): SkinRegistry {
  const registry = new SkinRegistry();
  for (const skin of ALL_SKINS) {
    registry.register(skin);
  }
  return registry;
}

/**
 * Default skin ID.
 */
export const DEFAULT_SKIN_ID = 'analog-classic';
