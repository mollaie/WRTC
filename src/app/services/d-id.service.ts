import { Injectable } from '@angular/core';
import { API_KEY, IMAGE_URL, VF_API_KEY, VF_VERSION } from '../../../config';
import { SharedService } from './shared.service';
import { firstValueFrom, take } from 'rxjs';
import { query } from 'express';
import { SampleImageOne } from '../image.config';

@Injectable({
  providedIn: 'root',
})
export class DIDService {
  private peerConnection!: RTCPeerConnection;
  private dataChannel!: RTCDataChannel;
  private currentVideoStream: MediaStream | null = null;
  private lastState = {};
  private firstRequest = true;
  private DID_API = {
    url: 'https://api.d-id.com',
    key: API_KEY,
    service: 'talks',
  };

  private VOICEFLOW_API = {
    url: 'https://general-runtime.voiceflow.com/state',
    second_url: 'https://general-runtime.voiceflow.com/interact',
    key: VF_API_KEY,
    version: VF_VERSION,
    userId: 'Bosland-101',
  };

  private sourceUrl = SampleImageOne;

  constructor(private sharedService: SharedService) {}

  private getHeaders(): Record<string, string> {
    return {
      accept: 'application/json',
      authorization: `Basic ${this.DID_API.key}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeStream(): Promise<void> {
    const streamInitialized = await firstValueFrom(
      this.sharedService.streamInitialized$
    );
    if (streamInitialized) {
      console.log('Stream already initialized');
      return;
    }

    try {
      console.log('Initializing stream...');
      await this.connectToStream();
      console.log('Stream initialization complete');
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
    try {
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
      this.sharedService.setStreamId(newStreamId);
      this.sharedService.setSessionId(newSessionId);

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
        throw error;
      }
    } catch (error) {
      console.error('Error connecting to stream:', error);
      throw error;
    }
  }

  private async startStream(sessionClientAnswer: RTCSessionDescriptionInit) {
    const streamId = await firstValueFrom(this.sharedService.streamId$);
    const sessionId = await firstValueFrom(this.sharedService.sessionId$);

    if (!streamId) {
      throw new Error('Stream ID is not set.');
    }

    console.log('Starting stream...');
    const response = await fetch(
      `${this.DID_API.url}/${this.DID_API.service}/streams/${streamId}/sdp`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          answer: sessionClientAnswer,
          session_id: sessionId,
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
    const streamId = await firstValueFrom(this.sharedService.streamId$);
    const sessionId = await firstValueFrom(this.sharedService.sessionId$);

    if (!streamId || !sessionId) {
      throw new Error('Stream ID or Session ID is not set.');
    }

    const response = await fetch(
      `${this.DID_API.url}/talks/streams/${streamId}/ice`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          candidate: candidateStr,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId,
        }),
      }
    );
    return await response.json();
  }

  private onTrack(event: RTCTrackEvent) {
    if (event.streams && event.streams[0]) {
      this.sharedService.setVideoStream(event.streams[0]);
      this.sharedService.setStreamInitialized(true);
    }
  }

  getVideoStream(): MediaStream | null {
    return this.currentVideoStream;
  }

  closeStream() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.sharedService.setVideoStream(null);
  }

  stopAllStreams() {
    const currentStream = firstValueFrom(this.sharedService.videoStream$);
    if (currentStream) {
      currentStream.then((stream) => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          this.sharedService.setVideoStream(null);
        }
      });
    }
  }

  closePC() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null as any;
    }
  }

  async sendMessageToChat(messageText: string): Promise<void> {
    const streamId = await firstValueFrom(this.sharedService.streamId$);
    const sessionId = await firstValueFrom(this.sharedService.sessionId$);

    this.sharedService.addMessage({
      text: messageText,
      isMe: false,
      time: new Date(),
    });

    if (!streamId || !sessionId) {
      throw new Error('Stream ID or Session ID is not set.');
    }

    try {
      const response = await this.fetchWithRetries(
        `${this.DID_API.url}/talks/streams/${streamId}`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            script: {
              type: 'text',
              provider: {
                type: 'microsoft',
                voice_id: 'en-US-JennyNeural',
              },
              ssml: 'false',
              input: messageText,
            },
            config: {
              fluent: 'false',
              pad_audio: '0.0',
            },
            audio_optimization: '2',
            session_id: sessionId,
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

  async callVoiceFlowAPI(questionText: string) {
    const requestData = {
      config: {
        excludeTypes: ['speaker'],
        tts: true,
      },
      action: {
        // type: 'text',
        // payload: questionText,
        type: 'intent',
        payload: {
          confidence: 1,
          query: questionText,
          intent: {
            name: 'None',
          },
        },
      },
      // state: this.lastState,
    };

    const firstRequestData = {
      config: {
        excludeTypes: ['speaker'],
        tts: true,
      },
      action: {
        type: 'launch',
      },
    };

    console.log('Calling voiceflow');
    // console.log(this.VOICEFLOW_API.version)
    // console.log(this.firstRequest)
    var bodyData;
    if (this.firstRequest) {
      this.firstRequest = false;
      bodyData = firstRequestData;
    } else {
      bodyData = requestData;
    }
    console.log(JSON.stringify(bodyData));
    fetch(
      `${this.VOICEFLOW_API.url}/user/${this.VOICEFLOW_API.userId}/interact`,
      //`${this.VOICEFLOW_API.second_url}/${this.VOICEFLOW_API.version}`,
      {
        method: 'POST',
        headers: {
          Authorization: this.VOICEFLOW_API.key,
          'content-type': 'application/json',
          versionID: this.VOICEFLOW_API.version,
          accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify(bodyData),
      }
    )
      .then((response) => response.json())
      .then((data) => {
        //console.log('Success:', data[1].payload.message);
        //this.sendMessageToChat(data[1].payload.message);
        const result = data;
        if (Array.isArray(result)) {
          const messageIndex = result.findIndex((r) => r.type === 'text');
          if (messageIndex !== -1) {
            const message = result[messageIndex].payload.message;
            console.log(message);
            this.sendMessageToChat(message);
          }
        } else {
          console.log('Success:', data['state']['variables']['last_response']);
          this.sendMessageToChat(data['state']['variables']['last_response']);
          this.lastState = data['state'];
        }
      })
      .catch((error) => {
        console.error('Error in voiceflow:', error);
      });
  }

  private async fetchWithRetries(
    url: string,
    options: RequestInit,
    retries = 1
  ): Promise<Response> {
    const maxRetryCount = 5;
    const maxDelaySec = 10;

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay =
          Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) *
          1000;
        console.log(`Retrying ${retries}/${maxRetryCount}. ${err}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  }
}
