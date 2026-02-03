@echo off
chcp 65001 >nul
echo LAB Golf 자동주문 - 배포 패키지 생성
echo.

cd /d "%~dp0"

:: dist 폴더 정리
if exist "dist\release" rmdir /s /q "dist\release"
mkdir "dist\release"

:: 필요한 파일 복사
echo 파일 복사 중...
xcopy /E /I /Y "src" "dist\release\src"
xcopy /E /I /Y "node_modules" "dist\release\node_modules"
xcopy /E /I /Y "public" "dist\release\public" 2>nul
copy /Y "package.json" "dist\release\"
copy /Y ".env.example" "dist\release\.env.example"
copy /Y "launcher.js" "dist\release\"

:: 런처 exe 복사
copy /Y "dist\LAB자동주문.exe" "dist\release\"

:: 간단한 시작 배치 파일도 포함
echo @echo off > "dist\release\시작.bat"
echo chcp 65001 ^>nul >> "dist\release\시작.bat"
echo node src/server.js >> "dist\release\시작.bat"

echo.
echo 완료! dist\release 폴더에 배포 패키지가 생성되었습니다.
echo.
pause
