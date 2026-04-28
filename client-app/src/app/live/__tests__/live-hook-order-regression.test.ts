import * as fs from 'node:fs';
import * as path from 'node:path';

describe('live page hook ordering regression', () => {
  it('declares handleCloseProductModal before render-phase early return branches', () => {
    const filePath = path.resolve(__dirname, '../[streamKey]/page.tsx');
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split('\n');

    const renderPhaseLineNumberOf = (needle: string) =>
      lines.findIndex(
        (line, index) => index > 500 && line.includes(needle) && line.trimStart().startsWith(needle),
      );

    const callbackLine = renderPhaseLineNumberOf('const handleCloseProductModal = useCallback(');
    const streamKeyReturnLine = renderPhaseLineNumberOf('if (!streamKey)');
    const loadingReturnLine = renderPhaseLineNumberOf('if (isLoading || !isMobileReady) {');
    const errorReturnLine = renderPhaseLineNumberOf('if (error || !streamStatus) {');
    const offlineReturnLine = renderPhaseLineNumberOf("if (streamStatus.status !== 'LIVE') {");

    expect(callbackLine).toBeGreaterThan(-1);
    expect(streamKeyReturnLine).toBeGreaterThan(-1);
    expect(loadingReturnLine).toBeGreaterThan(-1);
    expect(errorReturnLine).toBeGreaterThan(-1);
    expect(offlineReturnLine).toBeGreaterThan(-1);

    expect(callbackLine).toBeLessThan(streamKeyReturnLine);
    expect(callbackLine).toBeLessThan(loadingReturnLine);
    expect(callbackLine).toBeLessThan(errorReturnLine);
    expect(callbackLine).toBeLessThan(offlineReturnLine);
  });
});
