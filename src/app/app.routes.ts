import { Routes } from '@angular/router';
import path from 'path';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'stream-config',
    pathMatch: 'full',
  },
  {
    path: 'stream-config',
    loadComponent: () =>
      import('./features/stream-config.component').then(
        (m) => m.StreamConfigComponent
      ),
  },
];
