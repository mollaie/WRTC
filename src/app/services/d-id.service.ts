import { Injectable } from '@angular/core';
import { API_KEY } from '../../../config';
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
  private agentId!: string;
  private chatId!: string;
  private videoStreamSubject = new BehaviorSubject<MediaStream | null>(null);

  private DID_API = {
    url: 'https://api.d-id.com',
    key: API_KEY,
    service: 'talks',
  };

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
      console.log('Starting agent workflow...');
      const { agentId, chatId } = await this.agentsAPIworkflow();
      this.agentId = agentId;
      this.chatId = chatId;
      console.log(`Agent ID: ${agentId}, Chat ID: ${chatId}`);

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
    if (!this.agentId) {
      alert(
        "1. Click on the 'Create new Agent with Knowledge' button\n2. Open the Console and wait for the process to complete\n3. Press on the 'Connect' button\n4. Type and send a message to the chat\nNOTE: You can store the created 'agentID' and 'chatId' variables at the bottom of the JS file for future chats"
      );
      return;
    }

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

  private async createKnowledgeBase() {
    const response = await axios.post(
      `${this.DID_API.url}/knowledge`,
      {
        name: 'knowledge',
        description: 'D-ID Agents API',
      },
      {
        headers: this.getHeaders(),
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Failed to create knowledge base: ${response.statusText}`
      );
    }

    return response.data.id;
  }

  private async addDocumentToKnowledgeBase(knowledgeId: string) {
    const response = await axios.post(
      `${this.DID_API.url}/knowledge/${knowledgeId}/documents`,
      {
        documentType: 'pdf',
        source_url:
          'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/Prompt_engineering_Wikipedia.pdf',
        title: 'Prompt Engineering Wikipedia Page PDF',
      },
      {
        headers: this.getHeaders(),
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Failed to add document to knowledge base: ${response.statusText}`
      );
    }

    return response.data.id.split('#')[1];
  }

  private async checkKnowledgeStatus(knowledgeId: string, documentId: string) {
    const maxRetryCount = 5;
    const maxDelaySec = 10;

    const retry = async (url: string, retries = 1): Promise<void> => {
      try {
        const response = await axios.get(url, {
          headers: this.getHeaders(),
        });
        if (response.data.status !== 'done') {
          throw new Error("Status is not 'done'");
        }
      } catch (err) {
        if (retries <= maxRetryCount) {
          const delay =
            Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) *
            1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          console.log(`Retrying ${retries}/${maxRetryCount}. ${err}`);
          return retry(url, retries + 1);
        } else {
          throw new Error(`Max retries exceeded. error: ${err}`);
        }
      }
    };

    await retry(
      `${this.DID_API.url}/knowledge/${knowledgeId}/documents/${documentId}`
    );
    await retry(`${this.DID_API.url}/knowledge/${knowledgeId}`);
  }

  private async createAgent(knowledgeId: string) {
    const response = await axios.post(
      `${this.DID_API.url}/agents`,
      {
        knowledge: {
          provider: 'pinecone',
          embedder: {
            provider: 'pinecone',
            model: 'ada02',
          },
          id: knowledgeId,
        },
        presenter: {
          type: 'talk',
          voice: {
            type: 'microsoft',
            voice_id: 'en-US-JennyMultilingualV2Neural',
          },
          thumbnail: this.sourceUrl,
          source_url: this.sourceUrl,
        },
        llm: {
          type: 'openai',
          provider: 'openai',
          model: 'gpt-3.5-turbo-1106',
          instructions:
            'Your name is Emma, an AI designed to assist with information about Prompt Engineering and RAG',
        },
        preview_name: 'Emma',
      },
      {
        headers: this.getHeaders(),
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }

    return response.data.id;
  }

  private async createChatSession(agentId: string) {
    const response = await axios.post(
      `${this.DID_API.url}/agents/${agentId}/chat`,
      {},
      {
        headers: this.getHeaders(),
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to create chat session: ${response.statusText}`);
    }

    return response.data.id;
  }

  private async agentsAPIworkflow() {
    try {
      const knowledgeId = await this.createKnowledgeBase();
      const documentId = await this.addDocumentToKnowledgeBase(knowledgeId);
      await this.checkKnowledgeStatus(knowledgeId, documentId);
      const agentId = await this.createAgent(knowledgeId);
      const chatId = await this.createChatSession(agentId);
      return { agentId, chatId };
    } catch (error) {
      console.error('Error in agentsAPIworkflow:', error);
      throw error;
    }
  }

  async sendMessageToAgent(messageText: string): Promise<void> {
    try {
      const response = await this.fetchWithRetries(
        `${this.DID_API.url}/agents/${this.agentId}/chat/${this.chatId}`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            streamId: this.streamId,
            sessionId: this.sessionId,
            messages: [
              {
                role: 'user',
                content: messageText,
                created_at: new Date().toISOString(),
              },
            ],
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
}
