@echo off
echo ========================================
echo Dorami Live Commerce - ngrok Deployment
echo ========================================
echo.

REM Step 1: Backend Server 확인
echo [1/4] Checking backend server...
timeout /t 2 /nobreak >nul
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Backend is not running. Starting backend...
    start "Backend Server" cmd /k "cd backend && npm run start:dev"
    echo Waiting for backend to start...
    timeout /t 15 /nobreak >nul
)
echo Backend is ready!
echo.

REM Step 2: Backend ngrok 터널
echo [2/4] Starting ngrok tunnel for backend (port 3001)...
start "ngrok Backend" cmd /k "ngrok http 3001"
echo Waiting for ngrok to initialize...
timeout /t 10 /nobreak >nul
echo.

REM Step 3: ngrok URL 가져오기
echo [3/4] Getting ngrok URL...
timeout /t 3 /nobreak >nul
curl -s http://localhost:4040/api/tunnels > ngrok-info.json 2>nul
echo.

REM Step 4: 사용자에게 안내
echo [4/4] Setup Complete!
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Check the ngrok window for the backend URL
echo    Example: https://xxxx.ngrok-free.app
echo.
echo 2. Open browser and visit:
echo    - Backend API: https://YOUR-NGROK-URL/api
echo    - ngrok Dashboard: http://localhost:4040
echo.
echo 3. To deploy frontend, run:
echo    cd client-app
echo    npm run dev
echo.
echo 4. Open another ngrok tunnel for frontend:
echo    ngrok http 3000
echo.
echo ========================================
echo.
echo Press any key to open ngrok dashboard...
pause >nul
start http://localhost:4040

echo.
echo Deployment guide complete!
echo Keep all windows open for ngrok to work.
pause
