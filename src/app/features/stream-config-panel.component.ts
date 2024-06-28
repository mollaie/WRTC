import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FieldsetModule } from 'primeng/fieldset';
import { SignalService } from './signal.service';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { NgIf } from '@angular/common';
import { API_KEY } from '../../../config';

@Component({
  selector: 'app-stream-config-panel',
  template: `
    <p-fieldset legend="Server Config">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <p-floatLabel>
          <input pInputText id="apiKey" formControlName="apiKey" />
          <label for="apiKey">Enter API Key</label>
        </p-floatLabel>
        <p-floatLabel>
          <input pInputText id="source_url" formControlName="source_url" />
          <label for="source_url">Enter Source URL</label>
        </p-floatLabel>
        <div class="checkbox">
          <label for="stream_warmup">Stream Warm up</label>
          <p-inputSwitch formControlName="stream_warmup" />
        </div>
      </form>

      <div class="button">
        <button
          pButton
          pRipple
          label="Submit"
          class="p-button-success"
          (click)="submit()"
        ></button>

        <button
          pButton
          pRipple
          label="Cancel"
          class="p-button-secondary"
        ></button>
      </div>
    </p-fieldset>

    <p-fieldset legend="Create Talk" *ngIf="streamId && sessionId">
      <form [formGroup]="talkForm" (ngSubmit)="createTalk()">
        <p-floatLabel>
          <textarea
            pInputTextarea
            id="talkText"
            formControlName="talkText"
            rows="5"
          ></textarea>
          <label for="talkText">Enter Text for Talk</label>
        </p-floatLabel>

        <div class="button">
          <button
            pButton
            pRipple
            label="Create Talk"
            class="p-button-info"
            type="submit"
            [disabled]="talkForm.invalid"
          ></button>
        </div>
      </form>
    </p-fieldset>

    <video
      #videoElement
      autoplay
      playsinline
      style="with:200px;height:200px"
    ></video>
  `,
  standalone: true,
  imports: [
    FieldsetModule,
    ReactiveFormsModule,
    FloatLabelModule,
    InputTextModule,
    InputSwitchModule,
    ButtonModule,
    RippleModule,
    NgIf,
  ],
  styles: [
    `
      :host {
        width: 100%;

        form,
        input {
          width: 100%;
        }

        p-floatlabel {
          margin: 1rem;
        }

        .checkbox {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 1rem;
        }

        video {
          width: 100%;
          height: auto;
        }
      }
    `,
  ],
})
export class StreamConfigPanelComponent {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  form = new FormGroup({
    apiKey: new FormControl<string>(API_KEY || '', [Validators.required]),
    stream_warmup: new FormControl<boolean>(false, [Validators.required]),
    source_url: new FormControl<string>(
      'https://clips-presenters.d-id.com/alyssa/fIa7P15FTv/PWEobsgYC8/thumbnail.png',
      [Validators.required]
    ),
  });

  talkForm = new FormGroup({
    talkText: new FormControl<string>('', [Validators.required]),
  });

  streamId!: string;
  sessionId!: string;

  service = inject(SignalService);

  async submit() {
    console.log(this.form.value);
    if (this.form.valid) {
      const { source_url } = this.form.value;

      try {
        const streamData = await this.service.createStream(source_url!);
        const {
          offer,
          ice_servers,
          id: streamId,
          session_id: sessionId,
        } = streamData;

        this.streamId = streamId;
        this.sessionId = sessionId;

        this.service.initializeVideoElement(this.videoElement.nativeElement);
        const answer = await this.service.createPeerConnection(
          offer,
          ice_servers
        );

        await this.service.sendAnswer(answer);
      } catch (error) {
        console.error('Error during WebRTC initialization:', error);
      }
    }
  }

  async createTalk() {
    if (!this.streamId || !this.sessionId) {
      console.error('Stream ID or Session ID is missing');
      return;
    }

    const { talkText } = this.talkForm.value;

    try {
      const talkData = await this.service.createTalk(talkText!);
      console.log('Talk created:', talkData);
    } catch (error) {
      console.error('Error creating talk:', error);
    }
  }
}
