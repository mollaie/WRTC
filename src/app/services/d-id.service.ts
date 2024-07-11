import { Injectable } from '@angular/core';
import { API_KEY, VF_API_KEY, VF_VERSION } from '../../../config';
import { BehaviorSubject, Observable } from 'rxjs';
import axios from 'axios';

@Injectable({
  providedIn: 'root',
})
export class DIDService {
  private peerConnection!: RTCPeerConnection;
  private dataChannel!: RTCDataChannel;
  private streamId!: string;
  private sessionId!: string;
  // private agentId!: string;
  // private chatId!: string;
  private videoStreamSubject = new BehaviorSubject<MediaStream | null>(null);

  private DID_API = {
    url: 'https://api.d-id.com',
    key: API_KEY,
    service: 'talks',
  };

  private VOICEFLOW_API = {
    url: 'https://general-runtime.voiceflow.com/state',
    key: VF_API_KEY,
    version: VF_VERSION,
    userId: 'Bosland-user'
  }

  private sourceUrl =
    'https://i.ibb.co/HhRWmvs/Bosland-Env-Ai-Avatar-V5-min-compressed.jpg';

  private getHeaders(): Record<string, string> {
    return {
      accept: 'application/json',
      authorization: `Basic ${this.DID_API.key}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeStream(): Promise<void> {
    try {

      console.log('Initializing stream...');
      await this.connectToStream();
      console.log('Stream initialization complete');
      console.log(this.sessionId);

    } catch (error) {
      console.error('Error initializing stream:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  private async connectToStream() {

    if (
      this.peerConnection &&
      this.peerConnection.connectionState === 'connected'
    ) {
      return;
    }

    this.stopAllStreams();
    this.closePC();

    console.log('Creating a new stream...');
    const sessionResponse = await this.fetchWithRetries(
      `${this.DID_API.url}/${this.DID_API.service}/streams`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          source_url: this.sourceUrl,
        }),
      }
    );

    const {
      id: newStreamId,
      offer,
      ice_servers: iceServers,
      session_id: newSessionId,
    } = await sessionResponse.json();
    this.streamId = newStreamId;
    this.sessionId = newSessionId;

    try {
      const sessionClientAnswer = await this.createPeerConnection(
        offer,
        iceServers
      );
      await this.startStream(sessionClientAnswer);
    } catch (error) {
      console.error('Error during streaming setup:', error);
      this.stopAllStreams();
      this.closePC();
      return;
    }
  }

  private async startStream(sessionClientAnswer: RTCSessionDescriptionInit) {
    console.log('Starting stream...');
    const response = await fetch(
      `${this.DID_API.url}/${this.DID_API.service}/streams/${this.streamId}/sdp`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          answer: sessionClientAnswer,
          session_id: this.sessionId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `HTTP error! status: ${response.status}, body: ${errorText}`
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  private async createPeerConnection(
    offer: RTCSessionDescriptionInit,
    iceServers: RTCIceServer[]
  ) {
    this.peerConnection = new RTCPeerConnection({ iceServers });
    this.dataChannel = this.peerConnection.createDataChannel('DIDDataChannel');

    this.peerConnection.addEventListener(
      'icecandidate',
      this.onIceCandidate.bind(this)
    );
    this.peerConnection.addEventListener('track', this.onTrack.bind(this));

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  private async onIceCandidate(event: RTCPeerConnectionIceEvent) {
    if (event.candidate) {
      try {
        await this.sendIceCandidate(event.candidate);
      } catch (error) {
        console.error('Error sending ICE candidate:', error);
      }
    }
  }

  private async sendIceCandidate(candidate: RTCIceCandidate) {
    const { candidate: candidateStr, sdpMid, sdpMLineIndex } = candidate;
    const response = await fetch(
      `${this.DID_API.url}/talks/streams/${this.streamId}/ice`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          candidate: candidateStr,
          sdpMid,
          sdpMLineIndex,
          session_id: this.sessionId,
        }),
      }
    );
    return await response.json();
  }

  private onTrack(event: RTCTrackEvent) {
    if (event.streams && event.streams[0]) {
      this.videoStreamSubject.next(event.streams[0]);
    }
  }

  closeStream() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.videoStreamSubject.next(null);
  }

  stopAllStreams() {
    if (this.videoStreamSubject.value) {
      this.videoStreamSubject.value
        .getTracks()
        .forEach((track) => track.stop());
      this.videoStreamSubject.next(null);
    }
  }

  closePC() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null as any;
    }
  }

  getVideoStream(): Observable<MediaStream | null> {
    return this.videoStreamSubject.asObservable();
  }

  private async fetchWithRetries(
    url: string,
    options: RequestInit,
    retries = 1
  ): Promise<Response> {
    const maxRetryCount = 5;
    const maxDelaySec = 10;

    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay =
          Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) *
          1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log(`Retrying ${retries}/${maxRetryCount}. ${err}`);
        return this.fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  }

  // async makeItTalk(messageText :string) {
  //     console.log(`Sending message ${messageText}`)
  //     const reply:string = await this.callVoiceFlowAPI(messageText);
  //     console.log(`reply received ${reply}`)
  //     this.sendMessageToChat(reply);
  // }

  async sendMessageToChat(messageText: string): Promise<void> {
      try {
        const response = await this.fetchWithRetries(
          `${this.DID_API.url}/talks/streams/${this.streamId}`,
          {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              
              script: {
                type: "text",
                provider: {
                  type: "microsoft",
                  voice_id: "en-US-JennyNeural"
                },
                ssml: "false",
                input: messageText
              },
              config: {
                fluent: "false",
                pad_audio: "0.0"
              },
              audio_optimization: "2",
              session_id: this.sessionId,
            }),
          }
        );
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', response.status, errorText);
          throw new Error(
            `HTTP error! status: ${response.status}, body: ${errorText}`
          );
        }
  
        const data = await response.json();
        console.log('Message sent successfully:', data);
      } catch (error) {
        console.error('Error sending message to agent:', error);
        throw error;
      }
    }

    async callVoiceFlowAPI(questionText: string){
      const requestData = {
        request: {
          type: 'text',
          payload: questionText
        }
      };

      console.log('Calling voiceflow')
      fetch(`${this.VOICEFLOW_API.url}/${this.VOICEFLOW_API.version}/user/${this.VOICEFLOW_API.userId}/interact`, {
        method: 'POST',
        headers: {
          'Authorization': this.VOICEFLOW_API.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
        .then(response => response.json())
        .then(data => {
          console.log('Success:', data[1].payload.message);
          this.sendMessageToChat(data[1].payload.message)
        })
        .catch(error => {
          console.error('Error in voiceflow:', error);
        });
    }

}
