/**
 * Scene exports
 */

// Types and state
export {
  type SceneId,
  type ViewMode,
  type NavItem,
  type ClockState,
  type Viewport,
  type AppState,
  type FighterAction,
  type FighterState,
  type Particle,
  type HitEffect,
  // Emergent system types
  type CAGrid,
  type AgentDNA,
  type AIAgent,
  type EvolutionState,
  type EmergentState,
  NAV_ITEMS,
  createAppState,
  createFighterState,
  // Emergent system factories
  createCAGrid,
  createRandomDNA,
  createAIAgent,
  createEmergentState,
} from './types';

// Navigation
export { renderNavBar, getNavHeight, isInNavBar, getNavItemAt } from './nav-bar';

// Scenes
export { HomeScene } from './home-scene';
export { LabScene } from './lab-scene';
export { AboutScene } from './about-scene';
