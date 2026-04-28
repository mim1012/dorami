import fs from 'node:fs';
import path from 'node:path';

describe('Live player stability regressions', () => {
  const pagePath = path.join(__dirname, '..', '[streamKey]', 'page.tsx');
  const videoPlayerPath = path.join(
    __dirname,
    '..', '..', '..', 'components', 'stream', 'VideoPlayer.tsx',
  );

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const videoPlayerSource = fs.readFileSync(videoPlayerPath, 'utf8');

  it('does not force-remount VideoPlayer during STREAM_RECOVERED polling transitions', () => {
    expect(pageSource).not.toContain('setPlayerSessionSeed((prev) => prev + 1);');
  });

  it('defers player initialization by one frame to avoid same-frame unmount races', () => {
    expect(videoPlayerSource).toContain('const initTimer = setTimeout(() => {');
    expect(videoPlayerSource).toContain('clearTimeout(initTimer);');
  });

  it('tracks mounted state before async player init continues', () => {
    expect(videoPlayerSource).toContain('const isMountedRef = useRef(true);');
    expect(videoPlayerSource).toContain('const canUseVideoElement = useCallback(() => {');
    expect(videoPlayerSource).toContain(
      'return isMountedRef.current && !!videoRef.current && videoRef.current.isConnected;',
    );
  });
});
