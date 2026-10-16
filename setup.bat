@echo off
chcp 65001 >nul
title Pixel Draw - All-in-One Setup
echo ======================================================================
echo      PIXEL DRAW - TRINH CAI DAT TU DONG TRON GOI (ALL-IN-ONE SETUP)
echo ======================================================================
echo.

:: [1/5] Kiem tra Node.js va Python
echo [1/5] Kiem tra moi truong he thong...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may!
    echo Vui long cai dat Node.js (phien ban 18 tro len) tai: https://nodejs.org
    pause
    exit /b 1
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python tren may!
    echo Vui long cai dat Python (phien ban 3.10 tro len) tai: https://python.org
    echo Luu y: Hay tich chon 'Add Python to PATH' khi cai dat.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('python --version') do set PY_VER=%%v
echo   - Node.js: %NODE_VER% (San sang)
echo   - Python:  %PY_VER% (San sang)
echo.

:: [2/5] Cai dat Node.js dependencies
echo [2/5] Dang cai dat cac thu vien Node.js (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [LOI] Cai dat npm dependencies that bai!
    pause
    exit /b 1
)
echo.

:: [3/5] Thiet lap moi truong ao Python
echo [3/5] Dang thiet lap moi truong ao Python (.venv)...
if not exist ".venv" (
    echo   - Dang tao moi truong ao .venv...
    python -m venv .venv
)

echo   - Dang cap nhat pip va cai dat thu vien AI tu requirements.txt...
call .venv\Scripts\python -m pip install --upgrade pip
call .venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [CANH BAO] Co canh bao khi cai dat mot so goi Python.
)
echo.

:: [4/5] Tu dong tai cac Model AI (Checkpoint SD1.5 va LoRA)
echo [4/5] Dang kiem tra va tai cac mo hinh AI nang tu Hugging Face...
call .venv\Scripts\python scripts/download_models.py
echo.

:: [5/5] Bien dich cac goi du an
echo [5/5] Dang bien dich ma nguon du an (npm run build)...
call npm run build
echo.

echo ======================================================================
echo                  CAI DAT TRON GOI HOAN TAT!
echo ======================================================================
echo He thong Pixel Draw da san sang su dung.
echo.
echo De khoi dong ung dung:
echo   - Nhan dup chuot vao file 'start.bat'
echo   hoac
echo   - Chay lenh: npm run dev
echo.
echo ======================================================================
pause
