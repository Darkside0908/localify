const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');

function resolveFfmpeg() {
  const local = path.join(os.homedir(), '.local', 'bin', 'ffmpeg');
  if (fs.existsSync(local)) return local;
  return 'ffmpeg';
}

function captureNextFrame(win) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onPaint = (_event, _dirty, image) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(image);
    };
    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      win.webContents.removeListener('paint', onPaint);
      try {
        const img = await win.webContents.capturePage();
        resolve(img);
      } catch (err) {
        reject(err);
      }
    }, 120);

    win.webContents.once('paint', onPaint);
    win.webContents.invalidate();
  });
}

app.whenReady().then(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const motionHtml = path.join(__dirname, 'motion.html');
  const outMp4 = path.join(projectRoot, 'assets', 'localify-promo.mp4');

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true,
    show: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#0B0B0C',
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.setFrameRate(60);

  await win.loadFile(motionHtml);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');

  const ffmpegBin = resolveFfmpeg();
  const ff = spawn(
    ffmpegBin,
    [
      '-y',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      '-r',
      '30',
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'medium',
      '-crf',
      '19',
      '-movflags',
      '+faststart',
      outMp4,
    ],
    { shell: false, stdio: ['pipe', 'ignore', 'pipe'] },
  );

  let ffErr = '';
  ff.stderr.on('data', (d) => {
    ffErr += d.toString('utf8');
  });

  const ffExit = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${ffErr}`));
    });
  });

  const totalFrames = 480; // 16.0s @ 30fps
  for (let f = 0; f < totalFrames; f += 1) {
    const t = (f / 30).toFixed(4);
    await win.webContents.executeJavaScript(
      `window.renderFrame(${t}); void document.body.offsetHeight; true`,
    );
    const img = await captureNextFrame(win);
    const png = img.toPNG();
    if (!ff.stdin.write(png)) {
      await new Promise((res) => ff.stdin.once('drain', res));
    }
    if ((f + 1) % 60 === 0) {
      console.log(`FRAME ${f + 1}/${totalFrames}`);
    }
  }

  ff.stdin.end();
  await ffExit;
  console.log('PROMO_VIDEO_OK', outMp4);
  app.exit(0);
}).catch((err) => {
  console.error('PROMO_RENDER_ERROR', err);
  app.exit(1);
});
