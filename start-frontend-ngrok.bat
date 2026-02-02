@echo off
echo ========================================
echo Frontend Deployment with ngrok
echo ========================================
echo.

REM 백엔드 ngrok URL 입력받기
echo Please enter your BACKEND ngrok URL
echo Example: https://abc123-def-456.ngrok-free.app
echo (WITHOUT /api at the end)
echo.
set /p BACKEND_URL="Backend URL: "

if "%BACKEND_URL%"=="" (
    echo Error: Backend URL is required!
    pause
    exit /b 1
)

echo.
echo Setting up environment variables...

REM .env.local 파일 생성
cd client-app
(
echo # ngrok deployment config
echo NEXT_PUBLIC_API_URL=%BACKEND_URL%/api
echo NEXT_PUBLIC_WS_URL=%BACKEND_URL%
echo NEXT_PUBLIC_ENV=production
) > .env.local

echo Environment file created: .env.local
echo.
echo Contents:
type .env.local
echo.
echo.

REM 프론트엔드 빌드 옵션
echo Choose deployment option:
echo 1. Development mode (faster, hot reload)
echo 2. Production mode (optimized build)
echo.
set /p DEPLOY_MODE="Select (1 or 2): "

if "%DEPLOY_MODE%"=="2" (
    echo.
    echo Building for production...
    call npm run build
    if %errorlevel% neq 0 (
        echo Build failed!
        pause
        exit /b 1
    )
    echo.
    echo Starting production server...
    start "Frontend Production" cmd /k "npm start"
) else (
    echo.
    echo Starting development server...
    start "Frontend Dev" cmd /k "npm run dev"
)

echo Waiting for frontend to start...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo Frontend is starting!
echo ========================================
echo.
echo Local URL: http://localhost:3000
echo.
echo Now start ngrok for frontend:
echo   ngrok http 3000
echo.
echo ========================================
pause
