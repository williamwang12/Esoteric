@echo off
REM Esoteric Enterprises - Website Startup Script (Windows)
REM This script starts both the backend and frontend servers

setlocal enabledelayedexpansion
title Esoteric Enterprises - Website Startup

echo [INFO] Starting Esoteric Enterprises Website...

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] Please run this script from the Esoteric project root directory
    pause
    exit /b 1
)

if not exist "backend" (
    echo [ERROR] Backend directory not found
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERROR] Frontend directory not found
    pause
    exit /b 1
)

REM Check if .env files exist and create if needed
if not exist ".env" (
    echo [WARNING] .env file not found. Creating from template...
    copy env.example .env >nul
)

if not exist "backend\.env" (
    echo [WARNING] backend\.env file not found. Creating from template...
    copy backend\env.example backend\.env >nul
)

if not exist "frontend\.env" (
    echo [WARNING] frontend\.env file not found. Creating from template...
    copy frontend-env.example frontend\.env >nul
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Check if dependencies are installed
echo [INFO] Checking dependencies...
if not exist "backend\node_modules" (
    echo [WARNING] Backend dependencies not found. Installing...
    cd backend
    npm install
    cd ..
)

if not exist "frontend\node_modules" (
    echo [WARNING] Frontend dependencies not found. Installing...
    cd frontend
    npm install
    cd ..
)

REM Create logs directory
if not exist "logs" mkdir logs

REM Kill any existing processes on our ports
echo [INFO] Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5001" ^| find "LISTENING"') do (
    echo [WARNING] Killing process on port 5001...
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo [WARNING] Killing process on port 3000...
    taskkill /f /pid %%a >nul 2>&1
)

echo [INFO] Starting backend server on port 5001...
cd backend
start /b "" cmd /c "node server-2fa.js > ..\logs\backend.log 2>&1"
cd ..

REM Wait for backend to start
timeout /t 3 /nobreak >nul

echo [SUCCESS] Backend server started

echo [INFO] Starting frontend development server on port 3000...
cd frontend
start /b "" cmd /c "npm start > ..\logs\frontend.log 2>&1"
cd ..

echo [INFO] Waiting for frontend to compile...
timeout /t 10 /nobreak >nul

echo [SUCCESS] Frontend development server started

echo.
echo ================================
echo    WEBSITE IS NOW RUNNING!
echo ================================
echo.
echo Frontend:     http://localhost:3000
echo Backend API:  http://localhost:5001/api
echo Health Check: http://localhost:5001/api/health
echo.
echo Test Account:
echo   Email:    test@test.com
echo   Password: password123
echo.
echo Logs:
echo   Backend:  logs\backend.log
echo   Frontend: logs\frontend.log
echo.
echo Press any key to stop all servers...
pause >nul

REM Kill the processes
echo [INFO] Stopping servers...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5001" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [SUCCESS] All servers stopped.
pause