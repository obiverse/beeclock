import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { BeeApp } from './app/bee-app';

bootstrapApplication(BeeApp, appConfig)
  .catch((err) => console.error(err));
