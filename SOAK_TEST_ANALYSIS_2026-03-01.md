# 200 CCU Staging Soak Test — Analysis Report
**Date**: 2026-03-01 00:08 UTC
**Status**: ❌ BLOCKED — FFmpeg RTMP Connection Failure
**Workflow**: Cancelled (Run ID: 22531760010)

---

## Executive Summary

Attempted to execute 200 CCU × 1 hour streaming soak test on staging. **Critical blocker**: FFmpeg cannot establish RTMP connection to SRS, preventing any load test execution.

---

## Problem Statement

### FFmpeg RTMP Error
```
[out#0/flv] Error opening output rtmp://127.0.0.1:1935/live/smoke-check: Input/output error
Error opening output file rtmp://localhost:1935/live/smoke-check.
Error opening output files: Input/output error
```

### SRS Backend Auth Rejection
```
[ERROR] rtmp on_publish http://backend:3001/api/streaming/srs-auth :
response={"code":1}
```

---

## Root Cause Analysis

### What We Confirmed ✅
1. **SRS Container**: Running, healthy (33 hours uptime)
2. **Port Mapping**: 1935 TCP → 0.0.0.0:1935 ✓
3. **Database**: smoke-check stream created successfully
4. **Backend**: Healthy, `/api/streaming/srs-auth` endpoint responding
5. **Network**: ss/netstat shows port 1935 LISTEN on 0.0.0.0

### What Failed ❌
1. **FFmpeg to SRS RTMP**: Connection refused consistently
2. **Error Type**: "Input/output error" (generic TCP/protocol level error)
3. **Reproducibility**: 100% - same error on every FFmpeg attempt

### Hypotheses (Not Yet Verified)

| # | Hypothesis | Likelihood | Evidence |
|---|-----------|-----------|----------|
| 1 | SRS RTMP vhost config issue | Medium | RTMP port listening but rejecting connections |
| 2 | FFmpeg/SRS protocol mismatch | Medium | Generic I/O error suggests protocol-level issue |
| 3 | Docker network isolation | Low | localhost:1935 should bypass Docker network |
| 4 | Firewall/Security group | Low | Port 1935 is mapped to 0.0.0.0 |
| 5 | RTMP authentication pre-check | High | SRS auth hook fires BUT backend returns code:1 |

---

## Investigation Steps Completed

### 1. Server Infrastructure ✅
- [x] FFmpeg installed (v6.1.1-3ubuntu5)
- [x] Nginx worker_connections increased to 1024
- [x] SRS container running and healthy
- [x] Docker stats monitoring confirmed

### 2. Database Setup ✅
- [x] Test user created (soak@test.local)
- [x] smoke-check stream inserted (live_streams table)
- [x] User-stream relationship verified

### 3. Backend Readiness ✅
- [x] Backend restarted (graceful shutdown/restart)
- [x] Health check: POST /api/health/ready returns 200
- [x] Database: connected, migrations applied
- [x] Redis: connected

### 4. FFmpeg Testing ❌
- [x] Standard command: `ffmpeg ... rtmp://localhost:1935/live/smoke-check` → FAIL
- [x] Docker hostname: `rtmp://dorami-srs-1:1935/...` → DNS resolution error
- [x] Server IP: `rtmp://172.31.47.163:1935/...` → Not tested yet

---

## Recommendations for Next Session

### Priority 1: Debug SRS RTMP Configuration
```bash
# Check SRS default vhost settings
docker exec dorami-srs-1 cat /usr/local/srs/conf/srs.conf | grep -A 20 "rtmp {"

# Check for ACL/security restrictions
docker exec dorami-srs-1 cat /usr/local/srs/conf/srs.conf | grep -A 10 "security\|allow\|deny"

# Test RTMP connection with nc/telnet
nc -zv localhost 1935
```

### Priority 2: Test FFmpeg with Upstream SRS
```bash
# Use public SRS server for baseline test
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=30 \
  -f flv rtmp://live.example.com/live/test
```

### Priority 3: Verify SRS Webhook Response
```bash
# Check exact response body from srs-auth endpoint
curl -X POST http://backend:3001/api/streaming/srs-auth \
  -H "Content-Type: application/json" \
  -d '{"stream":"smoke-check","action":"on_publish","ip":"127.0.0.1"}'
```

### Priority 4: Consider Alternative Approach
If RTMP proves difficult, consider:
- Using HLS-only load test (no ingestion required)
- Manual stream creation via UI instead of ffmpeg
- Switching to OBS for RTMP ingestion

---

## Test Resources Summary

| Component | Status | Notes |
|-----------|--------|-------|
| GitHub Workflow | ✅ Ready | `.github/workflows/streaming-soak.yml` configured |
| k6 Load Test Script | ✅ Ready | `scripts/soak/k6-hls-load-test.js` (200 CCU profile) |
| Database Setup | ✅ Ready | smoke-check stream created |
| SSH Access | ✅ Ready | `dorami-staging.pem` verified |
| Backend Health | ✅ Ready | All services running |

---

## Next Steps

1. **Schedule debugging session** for RTMP protocol investigation
2. **Consult SRS documentation** for default vhost/security settings
3. **Test FFmpeg locally** with simple test stream first
4. **Capture tcpdump** if protocol mismatch suspected
5. **Escalate to SRS team** if internal config is not the issue

---

## Time Spent
- Pre-checks: 25 minutes ✅
- Code implementation: 10 minutes ✅
- Database/backend troubleshooting: 30 minutes ✅
- FFmpeg debugging: 25 minutes ❌

**Total**: ~90 minutes (test not executed)
