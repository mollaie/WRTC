import {
  DatePipe,
  NgClass,
  NgFor,
  NgIf,
  isPlatformBrowser,
} from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subscription } from 'rxjs';
import { AudioService } from '../services/audio.service';
import { DIDService } from '../services/d-id.service';

export interface Message {
  isMe: boolean;
  text: string;
  time: Date;
}

@Component({
  selector: 'app-chat',
  template: `
    <div class="chat-container">
      <div class="video-section">
        <video #videoPlayer autoplay playsinline>
          Your browser does not support the video tag.
        </video>
      </div>
      <div class="chat-section">
        <div class="message-container">
          <div
            *ngFor="let message of messages"
            class="message"
            [ngClass]="{
              'my-message': message.isMe,
              'other-message': !message.isMe
            }"
          >
            <p>{{ message.text }}</p>
            <span class="message-time">{{
              message.time | date : 'short'
            }}</span>
          </div>
        </div>
        <div class="input-container">
          <textarea
            rows="3"
            cols="30"
            pInputTextarea
            [(ngModel)]="currentMessage"
            [placeholder]="
              isRecording ? 'Recording...' : 'Type your message or record voice'
            "
            [disabled]="isRecording"
          ></textarea>
          <div *ngIf="transcriptionResult" class="transcription-result">
            <p>Transcription: {{ transcriptionResult }}</p>
          </div>

          <ng-container *ngIf="isLoading">
            <p-progressSpinner
              styleClass="w-1rem h-1rem"
              strokeWidth="8"
              fill="var(--surface-ground)"
              animationDuration=".5s"
            />
          </ng-container>

          <div class="button-container">
            <p-button
              *ngIf="isBrowser"
              icon="pi pi-microphone"
              (onClick)="toggleRecording()"
              [ngClass]="{ 'p-button-danger': isRecording }"
              [label]="isRecording ? 'Stop Recording' : 'Start Recording'"
            ></p-button>
            <p-button
              icon="pi pi-send"
              (onClick)="sendMessage()"
              [disabled]="
                (!currentMessage && !transcriptionResult) || isRecording
              "
              label="Send"
            ></p-button>
          </div>
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    ButtonModule,
    InputTextareaModule,
    NgClass,
    DatePipe,
    FormsModule,
    ProgressSpinnerModule,
  ],
  styles: [
    `
      :host {
        .chat-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        .video-section {
          flex: 2;
          padding: 10px;
          background-color: #f0f0f0;
        }

        img,
        video {
          width: 40vw;
          height: 100vh;
        }

        .video-player {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .chat-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 10px;
          background-color: #ffffff;
          border-left: 1px solid #e0e0e0;
        }

        .message-container {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }

        .message {
          margin-bottom: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          max-width: 80%;
        }

        .my-message {
          background-color: #dcf8c6;
          align-self: flex-end;
          margin-left: auto;
        }

        .other-message {
          background-color: #e5e5ea;
          align-self: flex-start;
        }

        .message-time {
          font-size: 0.8em;
          color: #888;
          display: block;
          text-align: right;
          margin-top: 4px;
        }

        .input-container {
          display: flex;
          flex-direction: column;
          padding: 10px;
          background-color: #f9f9f9;
          border-top: 1px solid #e0e0e0;
        }

        .button-container {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
        }

        .transcription-result {
          margin-top: 10px;
          padding: 5px;
          background-color: #e6f7ff;
          border-radius: 4px;
        }

        @media (max-width: 768px) {
          .chat-container {
            flex-direction: column;
          }

          .video-section,
          .chat-section {
            flex: none;
            width: 100%;
          }

          .video-section {
            height: 100vh;
          }

          .chat-section {
            height: 60vh;
          }
        }

        video {
          /* display: block; */
          background-image: url('https://i.ibb.co/HhRWmvs/Bosland-Env-Ai-Avatar-V5-min-compressed.jpg');
          background-position: top;
          /* position: absolute; */
          background-size: cover;
        }

        .animated {
          animation: opacityAnimation 0.2s ease-in-out;
        }

        @keyframes opacityAnimation {
          from {
            opacity: 0.8;
          }
          to {
            opacity: 1;
          }
        }
      }
    `,
  ],
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  messages: Message[] = [];
  currentMessage = '';
  isRecording = false;
  transcriptionResult = '';
  private recordingSubscription: Subscription | undefined;
  private videoStreamSubscription: Subscription | undefined;
  isBrowser: boolean;
  isLoading = false;
  errorMessage: string = '';
  videoLoaded = false;

  constructor(
    private audioService: AudioService,
    private didService: DIDService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    if (this.isBrowser) {
      this.initializeAudioRecording();
      this.recordingSubscription = this.audioService.isRecording$.subscribe(
        (isRecording) => (this.isRecording = isRecording)
      );
      await this.initializeDIDStream();
    }
  }

  ngOnDestroy() {
    if (this.recordingSubscription) {
      this.recordingSubscription.unsubscribe();
    }
    if (this.videoStreamSubscription) {
      this.videoStreamSubscription.unsubscribe();
    }
    this.didService.closeStream();
  }

  async initializeAudioRecording() {
    try {
      await this.audioService.initRecording();
    } catch (error) {
      console.error('Failed to initialize audio recording:', error);
    }
  }

  async initializeDIDStream() {
    try {
      await this.didService.initializeStream();
      this.videoStreamSubscription = this.didService
        .getVideoStream()
        .subscribe((stream) => {
          if (stream && this.videoPlayer) {
            this.videoPlayer.nativeElement.srcObject = stream;
            this.videoLoaded = true;
            this.videoPlayer.nativeElement.play().catch((e) => {
              this.videoLoaded = false;
              console.error('Error playing video:', e);
            });
          }
        });
    } catch (error) {
      console.error('Error initializing D-ID stream:', error);
    }
  }

  toggleRecording() {
    if (this.isBrowser) {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    }
  }

  startRecording() {
    this.audioService.toggleRecording();
    this.transcriptionResult = '';
  }

  async stopRecording() {
    this.isLoading = true;
    this.audioService.toggleRecording();
    try {
      const result = await this.audioService.getTranscription();
      this.transcriptionResult = result.text;
      this.currentMessage = result.text;
      this.isLoading = false;
    } catch (error) {
      console.error('Transcription error:', error);
      this.transcriptionResult = 'Failed to transcribe audio.';
      this.isLoading = false;
    }
  }

  async sendMessage() {
    const messageText = this.transcriptionResult || this.currentMessage;
    if (messageText) {
      this.messages.push({
        isMe: true,
        text: messageText,
        time: new Date(),
      });
      this.isLoading = true;
      this.errorMessage = '';

      try {
        await this.didService.callVoiceFlowAPI(messageText);
        this.messages.push({
          isMe: false,
          text: 'Message sent to agent',
          time: new Date(),
        });
      } catch (error) {
        console.error('Error sending message to agent:', error);
        this.errorMessage = 'Failed to send message. Please try again.';
        this.messages.push({
          isMe: false,
          text: 'Error: Failed to send message',
          time: new Date(),
        });
      } finally {
        this.isLoading = false;
      }

      this.currentMessage = '';
      this.transcriptionResult = '';
    }
  }
}
