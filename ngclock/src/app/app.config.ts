import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

/**
 * App Config: Minimal Angular config for Bee Framework app.
 *
 * No routing - all navigation is handled by Bee Framework scenes.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
  ]
};
