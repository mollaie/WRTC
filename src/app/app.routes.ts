import { Routes } from '@angular/router';
import path from 'path';
import { ChatComponent } from './features/chat.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full',
  },
  {
    path: 'stream-config',
    loadComponent: () =>
      import('./features/stream-config.component').then(
        (m) => m.StreamConfigComponent
      ),
  },
  {
    path: 'chat',
    component: ChatComponent,
  },
];
