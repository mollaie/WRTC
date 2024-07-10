import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  Subject,
  firstValueFrom,
  lastValueFrom,
} from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private silenceStart: number = 0;
  private readonly silenceDuration = 2; // in seconds
  private isRecordingSubject = new BehaviorSubject<boolean>(false);
  private transcriptionSubject = new Subject<{ text: string }>();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  public isRecording$: Observable<boolean> =
    this.isRecordingSubject.asObservable();
  public transcription$: Observable<{ text: string }> =
    this.transcriptionSubject.asObservable();

  async initRecording(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      const mediaStreamSource =
        this.audioContext.createMediaStreamSource(stream);
      const scriptProcessorNode = this.audioContext.createScriptProcessor(
        4096,
        1,
        1
      );

      scriptProcessorNode.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        this.checkForSilence(inputBuffer);
      };

      mediaStreamSource.connect(scriptProcessorNode);
      scriptProcessorNode.connect(this.audioContext.destination);

      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        this.audioChunks.push(event.data);
      });

      this.mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/mpeg' });
        this.audioChunks = [];
        const result = await this.sendToWhisperAPI(audioBlob);
        this.transcriptionSubject.next(result);
      });
    } catch (err) {
      console.error('Error initializing media recorder:', err);
      throw new Error('Failed to get access to the microphone.');
    }
  }

  toggleRecording(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.mediaRecorder) {
      throw new Error('Media recorder not initialized');
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.isRecordingSubject.next(false);
    } else {
      this.mediaRecorder.start();
      this.silenceStart = Date.now();
      this.isRecordingSubject.next(true);
    }
  }

  async getTranscription(): Promise<{ text: string }> {
    return firstValueFrom(this.transcription$);
  }

  private checkForSilence(inputBuffer: Float32Array): void {
    const isSilent = this.isBufferSilent(inputBuffer);
    if (
      isSilent &&
      Date.now() - this.silenceStart > this.silenceDuration * 1000
    ) {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        this.isRecordingSubject.next(false);
      }
    } else if (!isSilent) {
      this.silenceStart = Date.now();
    }
  }

  private isBufferSilent(buffer: Float32Array): boolean {
    const threshold = 0.02;
    return !buffer.some((value) => Math.abs(value) > threshold);
  }

  private async sendToWhisperAPI(audioBlob: Blob): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'audio.mp3');

    try {
      return await lastValueFrom(
        this.http.post<{ text: string }>(
          '/proxy/asr?task=transcribe&output=json',
          formData
        )
      );
    } catch (error) {
      console.error('Error sending audio to Whisper API:', error);
      throw new Error('Failed to send audio to Whisper API.');
    }
  }
}
