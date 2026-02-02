@echo off
chcp 65001 >nul
echo LAB Golf 자동주문 시스템을 시작합니다...
echo.

cd /d "%~dp0"

:: 서버 시작 (백그라운드)
start /B node src/server.js

:: 서버 시작 대기 (2초)
timeout /t 2 /nobreak >nul

:: 브라우저에서 열기
start http://localhost:54112

echo 브라우저에서 http://localhost:54112 로 접속되었습니다.
echo 이 창을 닫으면 서버가 종료됩니다.
echo.
echo 종료하려면 아무 키나 누르세요...
pause >nul

:: 서버 프로세스 종료
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *server*" >nul 2>&1
