import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SignalService {
  async createStream(
    apiUrl: string,
    apiKey: string,
    sourceUrl: string,
    streamWarmup: boolean
  ) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        stream_warmup: streamWarmup,
        source_url: sourceUrl,
        compatibility_mode: 'off',
      }),
    });
    const data = await response.json();
    return data;
  }

  async sendAnswer(
    apiUrl: string,
    apiKey: string,
    streamId: string,
    answer: RTCSessionDescriptionInit,
    sessionId: string
  ) {
    const response = await fetch(`${apiUrl}/${streamId}/sdp`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        answer,
        session_id: sessionId,
      }),
    });
    return response.json();
  }

  async sendIceCandidate(
    apiUrl: string,
    apiKey: string,
    streamId: string,
    candidate: RTCIceCandidate,
    sessionId: string
  ) {
    const { candidate: candidateStr, sdpMid, sdpMLineIndex } = candidate;
    const response = await fetch(`${apiUrl}/${streamId}/ice`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        candidate: candidateStr,
        sdpMid,
        sdpMLineIndex,
        session_id: sessionId,
      }),
    });
    return response.json();
  }

  async createTalk(
    apiUrl: string,
    apiKey: string,
    streamId: string,
    sessionId: string,
    talkText: string,
    source: string
  ) {
    const response = await fetch(`${apiUrl}/${streamId}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        script: {
          type: 'text',
          subtitles: 'false',
          provider: {
            type: 'microsoft',
            voice_id: 'en-US-JennyNeural',
          },
          input: talkText,
        },
        config: {
          fluent: 'false',
          pad_audio: '0.0',
        },
        face: {
          top_left: [32, 32],
          size: 128,
        },
        source_url: source,
      }),
    });
    const data = await response.json();
    return data;
  }
}
