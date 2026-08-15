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
const calibrationOverlay = document.querySelector<HTMLDivElement>('#calibration-overlay');
const calibrationTitle = document.querySelector<HTMLHeadingElement>('#calibration-title');
const calibrationStatus = document.querySelector<HTMLParagraphElement>('#calibration-status');
const stateCalibrating = document.querySelector<HTMLDivElement>('#state-calibrating');
const stateSuccess = document.querySelector<HTMLDivElement>('#state-success');
const stateMoveFace = document.querySelector<HTMLDivElement>('#state-move-face');
const debugFaceCount = document.querySelector<HTMLSpanElement>('#debug-face-count');
const debugStableFrames = document.querySelector<HTMLSpanElement>('#debug-stable-frames');
const debugPhase = document.querySelector<HTMLSpanElement>('#debug-phase');

if (!video || !canvas) {
  throw new Error('The video or canvas element is missing.');
}

if (!introVideo || !introContainer || !mainContent) {
  throw new Error('The intro video elements are missing.');
}

if (!calibrationOverlay || !calibrationTitle || !calibrationStatus) {
  throw new Error('The calibration UI elements are missing.');
}

if (!stateCalibrating || !stateSuccess || !stateMoveFace) {
  throw new Error('The calibration state boxes are missing.');
}

if (!debugFaceCount || !debugStableFrames || !debugPhase) {
  throw new Error('The debug HUD elements are missing.');
}

const videoElement: HTMLVideoElement = video;
const overlay: HTMLCanvasElement = canvas;
const introVideoElement: HTMLVideoElement = introVideo;
const introContainerElement: HTMLDivElement = introContainer;
const mainContentElement: HTMLDivElement = mainContent;
const calibrationOverlayElement: HTMLDivElement = calibrationOverlay;
const calibrationTitleElement: HTMLHeadingElement = calibrationTitle;
const calibrationStatusElement: HTMLParagraphElement = calibrationStatus;
const stateCalibratingElement: HTMLDivElement = stateCalibrating;
const stateSuccessElement: HTMLDivElement = stateSuccess;
const stateMoveFaceElement: HTMLDivElement = stateMoveFace;
const debugFaceCountElement: HTMLSpanElement = debugFaceCount;
const debugStableFramesElement: HTMLSpanElement = debugStableFrames;
const debugPhaseElement: HTMLSpanElement = debugPhase;
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

let calibrationComplete = false;
let calibrationStableFrames = 0;
const CALIBRATION_REQUIRED_FRAMES = 5;

function setCalibrationState(title: string, status: string, phase: 'calibrating' | 'success' | 'move'): void {
  calibrationTitleElement.textContent = title;
  calibrationStatusElement.textContent = status;
  debugPhaseElement.textContent = phase;

  const boxes = [
    stateCalibratingElement,
    stateSuccessElement,
    stateMoveFaceElement,
  ];

  for (const box of boxes) {
    box.classList.toggle('active', box === {
      calibrating: stateCalibratingElement,
      success: stateSuccessElement,
      move: stateMoveFaceElement,
    }[phase]);
  }
}

function drawLandmarks(faceLandmarker: FaceLandmarker): void {
  canvasContext.clearRect(0, 0, overlay.width, overlay.height);

  const result = faceLandmarker.detectForVideo(videoElement, performance.now());
  const drawingUtils = new DrawingUtils(canvasContext);

  const faceCount = result.faceLandmarks.length;
  debugFaceCountElement.textContent = String(faceCount);

  if (faceCount > 0) {
    if (!calibrationComplete) {
      calibrationStableFrames += 1;
    }

    if (calibrationStableFrames >= CALIBRATION_REQUIRED_FRAMES && !calibrationComplete) {
      calibrationComplete = true;
      calibrationStableFrames = CALIBRATION_REQUIRED_FRAMES;
      mainContentElement.classList.add('game-started');
      calibrationOverlayElement.style.opacity = '0';
      calibrationOverlayElement.style.pointerEvents = 'none';
      setCalibrationState('臉部已校正', '已成功偵測到臉部，準備進入遊戲。', 'success');

      setTimeout(() => {
        calibrationOverlayElement.style.display = 'none';
        mainContentElement.classList.add('map-visible');
      }, 800);
    } else if (!calibrationComplete) {
      setCalibrationState('校正中', '請將臉部置於畫面中央，保持靜止幾秒。', 'calibrating');
    }

    debugStableFramesElement.textContent = String(calibrationStableFrames);

    for (const landmarks of result.faceLandmarks) {
      drawingUtils.drawLandmarks(landmarks, { color: '#00ff88', radius: 1.5 });
    }
  } else {
    calibrationStableFrames = 0;
    calibrationComplete = false;
    calibrationOverlayElement.style.opacity = '1';
    calibrationOverlayElement.style.display = 'grid';
    calibrationOverlayElement.style.pointerEvents = 'auto';
    debugStableFramesElement.textContent = '0';
    setCalibrationState('請移動臉部', '請將臉部移到圓框中央，並保持正面朝向鏡頭。', 'move');
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
