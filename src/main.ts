import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import './style.css';

const video = document.querySelector<HTMLVideoElement>('#webcam');
const canvas = document.querySelector<HTMLCanvasElement>('#overlay');

if (!video || !canvas) {
  throw new Error('The video or canvas element is missing.');
}

const videoElement: HTMLVideoElement = video;
const overlay: HTMLCanvasElement = canvas;
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
  const [faceLandmarker] = await Promise.all([
    createFaceLandmarker(),
    startWebcam(),
  ]);

  drawLandmarks(faceLandmarker);
}

main().catch((error: unknown) => {
  console.error('Unable to start face landmarks:', error);
});
