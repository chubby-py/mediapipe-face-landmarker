import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

const video = document.querySelector<HTMLVideoElement>('#webcam');
const canvas = document.querySelector<HTMLCanvasElement>('#overlay');
const introVideo = document.querySelector<HTMLVideoElement>('#intro-video');
const introContainer = document.querySelector<HTMLDivElement>('#intro-container');
const mainContent = document.querySelector<HTMLDivElement>('#main-content');
const skipBtn = document.querySelector<HTMLButtonElement>('#skip-btn');

if (!video || !canvas) {
  throw new Error('The video or canvas element is missing.');
}

if (!introVideo || !introContainer || !mainContent) {
  throw new Error('The intro video elements are missing.');
}

const videoElement: HTMLVideoElement = video;
const overlay: HTMLCanvasElement = canvas;
const introVideoElement: HTMLVideoElement = introVideo;
const introContainerElement: HTMLDivElement = introContainer;
const mainContentElement: HTMLDivElement = mainContent;
const context = overlay.getContext('2d');

if (!context) {
  throw new Error('Could not create a 2D canvas context.');
}

const canvasContext: CanvasRenderingContext2D = context;

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
  );

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
}

async function startWebcam(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  await new Promise<void>((resolve) => {
    videoElement.addEventListener('loadeddata', () => resolve(), { once: true });
  });

  overlay.width = videoElement.videoWidth;
  overlay.height = videoElement.videoHeight;
}

async function playIntroVideo(): Promise<void> {
  // 设置欢迎视频源（放在 public/intro.mp4）
  introVideoElement.src = '/intro.mp4';
  
  return new Promise<void>((resolve) => {
    const handleEnded = () => {
      // 视频播放完成
      introContainerElement.classList.add('hidden');
      mainContentElement.classList.remove('hidden');
      introVideoElement.removeEventListener('ended', handleEnded);
      skipBtn?.removeEventListener('click', handleSkip);
      resolve();
    };
    
    const handleSkip = () => {
      // 跳过按钮被点击
      introVideoElement.pause();
      introContainerElement.classList.add('hidden');
      mainContentElement.classList.remove('hidden');
      introVideoElement.removeEventListener('ended', handleEnded);
      skipBtn?.removeEventListener('click', handleSkip);
      resolve();
    };
    
    introVideoElement.addEventListener('ended', handleEnded);
    skipBtn?.addEventListener('click', handleSkip);
    introVideoElement.play();
  });
}

function drawLandmarks(faceLandmarker: FaceLandmarker): void {
  canvasContext.clearRect(0, 0, overlay.width, overlay.height);

  const result = faceLandmarker.detectForVideo(videoElement, performance.now());
  const drawingUtils = new DrawingUtils(canvasContext);

  for (const landmarks of result.faceLandmarks) {
    drawingUtils.drawLandmarks(landmarks, { color: '#00ff88', radius: 1.5 });
  }

  requestAnimationFrame(() => drawLandmarks(faceLandmarker));
}

async function main(): Promise<void> {
  // 先播放欢迎视频
  await playIntroVideo();
  
  // 欢迎视频播完后，启动 MediaPipe
  const [faceLandmarker] = await Promise.all([
    createFaceLandmarker(),
    startWebcam(),
  ]);

  drawLandmarks(faceLandmarker);
}

main().catch((error: unknown) => {
  console.error('Unable to start face landmarks:', error);
});
