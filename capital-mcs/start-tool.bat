@echo off
title Khởi Động Tiện Ích MMO PRO
echo ==========================================
echo    KHOI DONG TIEN ICH TU DONG HOA MMO PRO
echo ==========================================
echo.

:: 1. Kiểm tra xem Node.js đã được cài đặt chưa
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Node.js chua duoc cai dat tren may tinh nay!
    echo Vui long tai va cai dat Node.js tu: https://nodejs.org/ (Chon ban LTS)
    echo Sau khi cai dat xong, hay chay lai file nay.
    echo.
    pause
    exit
)

:: 2. Kiểm tra xem có thư mục node_modules chưa, nếu chưa thì chạy npm install
if not exist "node_modules\" (
    echo Dang cai dat cac thu vien can thiet (npm install)...
    echo Quá trình nay co the mat 1-2 phut, vui long cho...
    call npm install
    echo.
)

:: 3. Tự động mở trình duyệt dẫn tới trang Tool local
echo Dang khoi dong server va mo giao dien Tool...
start http://localhost:3000

:: 4. Chạy tool local
call npm run dev

pause
