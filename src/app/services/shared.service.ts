import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Message {
  isMe: boolean;
  text: string;
  time: Date;
}

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  private streamIdSubject = new BehaviorSubject<string | null>(null);
  private sessionIdSubject = new BehaviorSubject<string | null>(null);
  private videoStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  private streamInitializedSubject = new BehaviorSubject<boolean>(false);
  private messagesSubject = new BehaviorSubject<Message[]>([]);

  streamId$ = this.streamIdSubject.asObservable();
  sessionId$ = this.sessionIdSubject.asObservable();
  videoStream$ = this.videoStreamSubject.asObservable();
  streamInitialized$ = this.streamInitializedSubject.asObservable();
  messages$ = this.messagesSubject.asObservable();

  private bc = new BroadcastChannel('shared-service');

  constructor() {
    this.bc.onmessage = (event) => {
      const { type, payload } = event.data;
      switch (type) {
        case 'setStreamId':
          this.streamIdSubject.next(payload);
          break;
        case 'setSessionId':
          this.sessionIdSubject.next(payload);
          break;
        case 'streamInitialized':
          this.streamInitializedSubject.next(true);
          break;
        case 'addMessage':
          const messages = this.messagesSubject.getValue();
          messages.push(payload);
          this.messagesSubject.next(messages);
          break;
      }
    };
  }

  setStreamId(streamId: string) {
    this.streamIdSubject.next(streamId);
    this.bc.postMessage({ type: 'setStreamId', payload: streamId });
  }

  setSessionId(sessionId: string) {
    this.sessionIdSubject.next(sessionId);
    this.bc.postMessage({ type: 'setSessionId', payload: sessionId });
  }

  setVideoStream(videoStream: MediaStream | null) {
    this.videoStreamSubject.next(videoStream);
  }

  setStreamInitialized(initialized: boolean) {
    this.streamInitializedSubject.next(initialized);
    if (initialized) {
      this.bc.postMessage({ type: 'streamInitialized' });
    }
  }

  addMessage(message: Message) {
    const messages = this.messagesSubject.getValue();
    messages.push(message);
    this.messagesSubject.next(messages);
    this.bc.postMessage({ type: 'addMessage', payload: message });
  }
}
