import { Component, input, signal, viewChild } from '@angular/core';
import { SplitterModule } from 'primeng/splitter';
import { StreamConfigPanelComponent } from './stream-config-panel.component';

@Component({
  selector: 'app-stream-config',
  template: `
    <p-splitter [style]="{ height: '100vh' }" styleClass="mb-5 pt-4">
      <ng-template pTemplate>
        <div
          class="col flex align-items-center justify-content-center "
          style="width:100%; padding:1rem;"
        >
          <app-stream-config-panel />
        </div>
      </ng-template>
      <ng-template pTemplate>
        <div
          class="col flex align-items-center justify-content-center"
          style="width:100%; padding:1rem;display:flex;flex-direction:column;"
        >
          <video id="localVideo" autoplay muted #localVideoPlayer></video>
          <video id="remoteVideo" autoplay #remoteVideoPlayer></video>
        </div>
      </ng-template>
    </p-splitter>
  `,
  standalone: true,
  imports: [SplitterModule, StreamConfigPanelComponent],
  styles: [
    `
      :host {
        app-stream-config-panel {
          width: 100%;
        }
      }
    `,
  ],
})
export class StreamConfigComponent {
  localVideo = signal<MediaStream | null>(null);
  remoteVideo = signal<MediaStream | null>(null);
  localVideoPlayer = viewChild<HTMLVideoElement>('localVideoPlayer');
  remoteVideoPlayer = viewChild<HTMLVideoElement>('remoteVideoPlayer');

  setLocalVideo(stream: MediaStream) {
    this.localVideo.set(stream);
    this.localVideoPlayer()!.srcObject = stream;
  }

  setRemoteVideo(stream: MediaStream) {
    this.remoteVideo.set(stream);
    this.remoteVideoPlayer()!.srcObject = stream;
  }
}
