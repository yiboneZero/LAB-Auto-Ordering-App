@echo off
chcp 65001 >nul
echo LAB Golf 자동주문 서버를 종료합니다...
taskkill /F /IM node.exe >nul 2>&1
echo 서버가 종료되었습니다.
timeout /t 2 >nul
