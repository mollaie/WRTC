import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SignalService {
  private peerConnection!: RTCPeerConnection;
  private dataChannel!: RTCDataChannel;
  private videoElement!: HTMLVideoElement;
  private streamId!: string;
  private sessionId!: string;

  private DID_API = {
    url: 'https://api.d-id.com',
    service: 'talks',
    key: 'bWlsYW5tZXliZXJnQGdtYWlsLmNvbQ:jbLkpeN0WcR-WM_D3Rcq9',
  };

  initializeVideoElement(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
  }

  async createStream(sourceUrl: string) {
    const response = await fetch(
      `${this.DID_API.url}/${this.DID_API.service}/streams`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${this.DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: sourceUrl,
        }),
      }
    );
    const data = await response.json();
    this.streamId = data.id;
    this.sessionId = data.session_id;
    return data;
  }

  async sendAnswer(answer: RTCSessionDescriptionInit) {
    const response = await fetch(
      `${this.DID_API.url}/${this.DID_API.service}/streams/${this.streamId}/sdp`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${this.DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer,
          session_id: this.sessionId,
        }),
      }
    );
    return await response.json();
  }

  async sendIceCandidate(candidate: RTCIceCandidate) {
    const { candidate: candidateStr, sdpMid, sdpMLineIndex } = candidate;
    const response = await fetch(
      `${this.DID_API.url}/${this.DID_API.service}/streams/${this.streamId}/ice`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${this.DID_API.key}`,
          'Content-Type': 'application/json',
        },
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

  async createPeerConnection(
    offer: RTCSessionDescriptionInit,
    iceServers: RTCIceServer[]
  ) {
    this.peerConnection = new RTCPeerConnection({ iceServers });
    this.dataChannel =
      this.peerConnection.createDataChannel('JanusDataChannel');

    this.peerConnection.addEventListener(
      'icegatheringstatechange',
      this.onIceGatheringStateChange.bind(this)
    );
    this.peerConnection.addEventListener(
      'icecandidate',
      this.onIceCandidate.bind(this)
    );
    this.peerConnection.addEventListener(
      'iceconnectionstatechange',
      this.onIceConnectionStateChange.bind(this)
    );
    this.peerConnection.addEventListener(
      'connectionstatechange',
      this.onConnectionStateChange.bind(this)
    );
    this.peerConnection.addEventListener(
      'signalingstatechange',
      this.onSignalingStateChange.bind(this)
    );
    this.peerConnection.addEventListener('track', this.onTrack.bind(this));

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.dataChannel.onopen = () => {
      console.log('datachannel open');
    };

    this.dataChannel.onmessage = (event) => {
      console.log('DataChannel Message:', event.data);
    };

    this.dataChannel.onclose = () => {
      console.log('datachannel close');
    };

    return answer;
  }

  private onIceGatheringStateChange() {
    console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
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

  private onIceConnectionStateChange() {
    console.log(
      'ICE connection state:',
      this.peerConnection.iceConnectionState
    );
  }

  private onConnectionStateChange() {
    console.log('Connection state:', this.peerConnection.connectionState);
  }

  private onSignalingStateChange() {
    console.log('Signaling state:', this.peerConnection.signalingState);
  }

  private onTrack(event: RTCTrackEvent) {
    if (!event.track) return;
    const stream = event.streams[0];
    this.videoElement.srcObject = stream;

    this.videoElement.onloadedmetadata = () => {
      this.videoElement
        .play()
        .catch((e) => console.error('Error playing video:', e));
    };
  }

  async createTalk(talkText: string) {
    const response = await fetch(
      //`${this.DID_API.url}/agents/${this.streamId}/chat/${this.sessionId}`,
      `${this.DID_API.url}/talks/streams/${this.streamId}`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${this.DID_API.key}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          streamId: this.streamId,
          session_id: this.sessionId,
          script: {
            type: 'audio',
            audio_url:
              'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3',
          },
          ...(this.DID_API.service === 'clips' && {
            background: {
              color: '#FFFFFF',
            },
          }),
          config: {
            stitch: true,
          },
          messages: [
            {
              role: 'user',
              content: talkText,
              created_at: new Date().toString(),
            },
          ],
        }),
      }
    );
    return await response.json();
  }
}
