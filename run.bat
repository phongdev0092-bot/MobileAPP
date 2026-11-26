@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title NextSu AI - MobileApp Launcher

echo ========================================================
echo    NEXTSU AI - FPT TELECOM MOBILE APP (SHA-256 SHEET)
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [LOI] Chua cai dat Node.js tren may tinh nay.
    echo Vui long tai va cai dat Node.js LTS tai https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Lan dau khoi chay: dang cai dat thu vien npm...
    call npm install
    if errorlevel 1 (
        echo [LOI] Cai dat npm that bai.
        pause
        exit /b 1
    )
)

echo Chon che do chay thu:
echo   [1] Mo ngay tren Trinh duyet Web (Mac dinh - nhan Enter)
echo   [2] Chay tren Dien thoai that qua QR Code / Expo Go
echo   [3] Chay kiem thu tu dong SHA-256 ^& quet bao mat
echo.
set "MODE=1"
set /p "MODE=Nhap lua chon [1/2/3, Enter = 1]: "

if "%MODE%"=="2" (
    echo.
    echo [*] Dang khoi dong Expo Go Server ^(quet ma QR bang dien thoai cung Wi-Fi^)...
    call npx expo start -c
    goto :END
)

if "%MODE%"=="3" (
    echo.
    echo [*] Dang chay bo kiem thu SHA-256 Sheet Auth...
    call node scripts\test_sheet_auth_hash.js
    if errorlevel 1 goto :END
    echo.
    echo [*] Dang quet kiem tra bao mat...
    call node scripts\check_secrets.js
    echo.
    pause
    exit /b 0
)

echo.
echo [*] Dang khoi dong giao dien Web tai http://localhost:8081 ...
echo     ^(Nhan phim 'w' trong cua so nay neu trinh duyet chua tu mo^)
call npx expo start --web

:END
if errorlevel 1 (
    echo.
    echo [!] Tien trinh ket thuc voi ma loi %errorlevel%.
)
pause
