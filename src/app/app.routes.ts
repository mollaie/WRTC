import { Routes } from '@angular/router';
import path from 'path';
import { ChatComponent } from './features/chat.component';
import { MinimalChatComponent } from './features/minimal-chat.component';
import { StreamComponent } from './features/stream.component';

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
  {
    path: 'minimal-chat',
    component: MinimalChatComponent,
  },
  {
    path: 'stream',
    component: StreamComponent,
  },
];
