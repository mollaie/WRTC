import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DIDService } from '../services/d-id.service';
import { SharedService } from '../services/shared.service';
import { isPlatformBrowser, NgIf } from '@angular/common';
import { SampleImageOne } from '../image.config';

@Component({
  selector: 'app-stream',
  template: `
    <div class="container" #container>
      <div class="background-image"></div>
      <div class="video-container">
        <video
          #videoPlayer
          [class.visible]="videoLoaded"
          (loadedmetadata)="onVideoMetadataLoaded()"
          (error)="onVideoError()"
          autoplay
          playsinline
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div *ngIf="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [
    `
      .container {
        position: relative;
        width: 100%;
        height: 100vh;
        overflow: scroll;
      }
      .background-image {
        // position: absolute;
        // top: 0;
        // left: 0;
        width: 100%;
        height: 100%;
        //background-image: url(SampleImageOne);
        //background-position: center;
        background-size: cover;
        // left: 50%;
        // transform: translate(-50%, -0%);
      }
      .video-container {
        position: absolute;
        top: 0;
        // left: 50%;
        // transform: translate(-50%, -0%);
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      video {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
      }
      video.visible {
        opacity: 1;
      }
      .error-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px;
        border-radius: 5px;
      }
    `,
  ],
  standalone: true,
  imports: [NgIf],
})
export class StreamComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('container') container!: ElementRef<HTMLDivElement>;
  private streamSubscription: Subscription | undefined;
  videoLoaded = false;
  isBrowser: boolean = false;
  errorMessage: string | null = null;
  isLoaded = false;

  constructor(
    private didService: DIDService,
    private sharedService: SharedService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      const backgroundImage = document.querySelector(
        '.background-image'
      ) as HTMLElement;
      if (backgroundImage) {
        backgroundImage.style.backgroundImage = `url(${SampleImageOne})`;
      }
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.adjustVideoPosition();
  }

  async ngOnInit() {
    if (this.isBrowser) {
      try {
        await this.initializeDIDStream();
        this.streamSubscription = this.sharedService.videoStream$.subscribe(
          async (stream) => {
            if (stream) {
              this.videoPlayer.nativeElement.srcObject = stream;
              this.videoLoaded = true;
              this.errorMessage = null;
            } else {
              this.videoLoaded = false;
            }
          }
        );
      } catch (error) {
        console.error('Error in ngOnInit:', error);
        this.handleError(error);
      }
    }
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.adjustVideoPosition();
    }
  }

  ngOnDestroy() {
    if (this.streamSubscription) {
      this.streamSubscription.unsubscribe();
    }
    this.didService.closeStream();
  }

  async initializeDIDStream() {
    try {
      await this.didService.initializeStream();
    } catch (error) {
      console.error('Error initializing D-ID stream:', error);
      this.handleError(error);
    }
  }

  onVideoMetadataLoaded() {
    console.log('Video metadata loaded');
    this.adjustVideoPosition();
    this.playVideo();
  }

  playVideo() {
    const playPromise = this.videoPlayer.nativeElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error('Error playing video:', error);
        this.handleError(error);
      });
    }
  }

  onVideoError() {
    this.videoLoaded = false;
    console.error('Video loading error');
    this.errorMessage = 'Error loading video. Please try again later.';
  }

  handleError(error: any) {
    if (error.status === 429) {
      this.errorMessage = 'Too many requests. Please try again later.';
    } else if (
      error instanceof DOMException &&
      error.name === 'NotAllowedError'
    ) {
      this.errorMessage =
        'Autoplay is not allowed. Please enable autoplay in your browser settings.';
    } else {
      this.errorMessage = 'An error occurred. Please try again later.';
    }
  }

  adjustVideoPosition() {
    const video = this.videoPlayer.nativeElement;
    const container = this.container.nativeElement;

    const containerAspect = container.clientWidth / container.clientHeight;
    const videoAspect = video.videoWidth / video.videoHeight;

    if (containerAspect > videoAspect) {
      // Container is wider than video
      video.style.width = 'auto';
      video.style.height = '100%';
    } else {
      // Container is taller than video
      video.style.width = '100%';
      video.style.height = 'auto';
    }
  }
}
