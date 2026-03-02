# 200 CCU Staging Soak Test — Analysis Report
**Date**: 2026-03-01 00:10 UTC
**Status**: ❌ BLOCKED — FFmpeg RTMP Connection Failure

---

## Problem
FFmpeg cannot establish RTMP connection to SRS at `rtmp://127.0.0.1:1935/live/smoke-check`

```
Error: [out#0/flv] Error opening output: Input/output error
SRS Auth: response={"code":1} (rejection)
```

---

## What We Verified ✅
| Item | Status | Evidence |
|------|--------|----------|
| SRS Container | ✅ Running | 33h uptime, CPU 0.54% |
| Port Mapping | ✅ Correct | `ss -tlnp` shows 1935 LISTEN on 0.0.0.0 |
| Database | ✅ Ready | smoke-check stream created in live_streams |
| Backend | ✅ Healthy | POST /api/health/ready = 200 |
| Network | ✅ Available | Docker port 1935 → host:1935 mapped |

---

## What Failed ❌
- **FFmpeg to RTMP**: Connection refused (generic "Input/output error")
- **SRS Webhook**: Backend returns `{"code":1}` (stream not allowed)
- **Root Cause**: **UNKNOWN** (SRS config? FFmpeg bug? Protocol mismatch?)

---

## Hypotheses to Test
1. **SRS vhost configuration** — Check default RTMP vhost settings
2. **FFmpeg/SRS protocol compatibility** — Test with simple librtmp client
3. **SRS security/ACL rules** — Check for allow/deny restrictions
4. **Docker network issue** — Test with server IP (172.31.47.163:1935)

---

## Next Session Checklist
- [ ] Review SRS configuration file (`/usr/local/srs/conf/srs.conf`)
- [ ] Test RTMP with `nc -zv localhost 1935`
- [ ] Capture tcpdump during FFmpeg connection attempt
- [ ] Test with public SRS server for baseline
- [ ] Verify `srs-auth` endpoint response with curl

---

## Resources Ready for Retry
✅ GitHub Workflow: `.github/workflows/streaming-soak.yml`
✅ k6 Script: `scripts/soak/k6-hls-load-test.js` (200 CCU profile)
✅ SSH Access: `dorami-staging.pem` verified
✅ Database: smoke-check stream created
✅ Backend: All services healthy

**Total Time Invested**: ~90 minutes (pre-checks + debugging, no test executed)
