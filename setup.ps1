# setup.ps1 - All-in-One Setup Script for Pixel Draw (PowerShell)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     PIXEL DRAW - TRINH CAI DAT TU DONG TRON GOI (POWERSHELL)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# [1/5] Kiem tra Node.js va Python
Write-Host "[1/5] Kiem tra moi truong he thong..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[LOI] Khong tim thay Node.js tren may!" -ForegroundColor Red
    Write-Host "Vui long cai dat Node.js (>= 18) tai: https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[LOI] Khong tim thay Python tren may!" -ForegroundColor Red
    Write-Host "Vui long cai dat Python (>= 3.10) tai: https://python.org" -ForegroundColor Red
    exit 1
}

$nodeVer = node -v
$pyVer = python --version
Write-Host "  - Node.js: $nodeVer" -ForegroundColor Green
Write-Host "  - Python:  $pyVer" -ForegroundColor Green
Write-Host ""

# [2/5] Cai dat Node dependencies
Write-Host "[2/5] Dang cai dat thu vien Node.js (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] Qua trinh npm install that bai!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# [3/5] Tao va thiet lap moi truong Python .venv
Write-Host "[3/5] Dang thiet lap moi truong ao Python (.venv)..." -ForegroundColor Yellow
if (-not (Test-Path ".venv")) {
    Write-Host "  - Dang tao thu muc .venv..." -ForegroundColor Gray
    python -m venv .venv
}

Write-Host "  - Dang cai dat thu vien AI tu requirements.txt..." -ForegroundColor Gray
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\pip.exe install -r requirements.txt
Write-Host ""

# [4/5] Tu dong tai Model AI
Write-Host "[4/5] Dang kiem tra va tai cac Model AI tu Hugging Face..." -ForegroundColor Yellow
& .\.venv\Scripts\python.exe scripts/download_models.py
Write-Host ""

# [5/5] Build packages
Write-Host "[5/5] Dang bien dich cac goi du an (npm run build)..." -ForegroundColor Yellow
npm run build
Write-Host ""

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "                  CAI DAT TRON GOI HOAN TAT!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Ban co the khoi dong du an bang cach:"
Write-Host "  - Chay: .\start.bat" -ForegroundColor Cyan
Write-Host "  hoac"
Write-Host "  - Chay: npm run dev" -ForegroundColor Cyan
Write-Host "======================================================================"
