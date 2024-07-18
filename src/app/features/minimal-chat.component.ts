import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subscription } from 'rxjs';
import { AudioService } from '../services/audio.service';
import { DIDService } from '../services/d-id.service';
import { SharedService, Message } from '../services/shared.service';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-minimal-chat',
  template: `
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
          <span class="message-time">{{ message.time | date : 'short' }}</span>
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
  `,
  standalone: true,
  imports: [
    NgFor,
    NgClass,
    NgIf,
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextareaModule,
    ProgressSpinnerModule,
  ],
})
export class MinimalChatComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  currentMessage = '';
  isRecording = false;
  transcriptionResult = '';
  private recordingSubscription: Subscription | undefined;
  private messagesSubscription: Subscription | undefined;
  isLoading = false;
  isBrowser: boolean = false;

  constructor(
    private audioService: AudioService,
    private didService: DIDService,
    private sharedService: SharedService,
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

      this.messagesSubscription = this.sharedService.messages$.subscribe(
        (messages) => {
          this.messages = messages;
        }
      );
    }
  }

  ngOnDestroy() {
    if (this.recordingSubscription) {
      this.recordingSubscription.unsubscribe();
    }
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }

  async initializeAudioRecording() {
    try {
      await this.audioService.initRecording();
    } catch (error) {
      console.error('Failed to initialize audio recording:', error);
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
      this.sendMessage();
    } catch (error) {
      console.error('Transcription error:', error);
      this.transcriptionResult = 'Failed to transcribe audio.';
      this.isLoading = false;
    }
  }

  async sendMessage() {
    const messageText = this.transcriptionResult || this.currentMessage;
    if (messageText) {
      const message: Message = {
        isMe: true,
        text: messageText,
        time: new Date(),
      };

      this.sharedService.addMessage(message);
      this.isLoading = true;

      try {
        await this.didService.callVoiceFlowAPI(messageText);
      } catch (error) {
        console.error('Error sending message to agent:', error);
      } finally {
        this.isLoading = false;
      }

      this.currentMessage = '';
      this.transcriptionResult = '';
    }
  }
}
