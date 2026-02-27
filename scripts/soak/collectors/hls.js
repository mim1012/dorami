const parseSegments = (text) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const segmentLines = lines.filter((line) => {
    if (line.startsWith('#')) return false;
    return /\.(ts|m4s|mp4|m3u8)$/.test(line);
  });
  const programDates = lines
    .filter((line) => line.startsWith('#EXT-X-PROGRAM-DATE-TIME'))
    .map((line) => line.replace('#EXT-X-PROGRAM-DATE-TIME:', '').trim())
    .map((v) => Date.parse(v))
    .filter((v) => Number.isFinite(v));

  return {
    segmentCount: segmentLines.length,
    programDateTimes: programDates,
    segmentSample: segmentLines.slice(-3),
  };
};

async function collectHlsMetrics({ url, streamKey, timeoutMs, headers }) {
  const playlistUrl = `${url.replace(/\/$/, '')}/hls/${encodeURIComponent(streamKey)}.m3u8`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(playlistUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const status = res.status;
    const body = await res.text();
    clearTimeout(timer);
    const parsed = parseSegments(body);
    const ageMs = parsed.programDateTimes.length
      ? Date.now() - parsed.programDateTimes[parsed.programDateTimes.length - 1]
      : null;

    return {
      status,
      available: status === 200,
      segmentCount: parsed.segmentCount,
      playlistLength: body.length,
      driftMs: ageMs != null ? Number(ageMs) : null,
      etag: res.headers.get('etag'),
      error: undefined,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      status: 0,
      available: false,
      segmentCount: null,
      playlistLength: 0,
      driftMs: null,
      etag: null,
      error: String(error?.name || error),
    };
  }
}

module.exports = {
  collectHlsMetrics,
};
