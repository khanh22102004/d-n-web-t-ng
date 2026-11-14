@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (
  echo Dang cai dat lan dau, vui long cho...
  python -m venv .venv || goto loi
)
fc /b requirements.txt .venv\requirements-installed.txt >nul 2>&1
if errorlevel 1 (
  echo Dang cap nhat thu vien, vui long cho...
  .venv\Scripts\python -m pip install -r requirements.txt || goto loi
  copy /y requirements.txt .venv\requirements-installed.txt >nul
)
if not exist .env copy .env.example .env >nul
echo.
echo Web dang chay tai http://localhost:8000
echo Trang nhan vien: http://localhost:8000/nhan-vien  (dat ADMIN_PASSWORD trong tep .env truoc)
echo Dong cua so nay de tat web.
echo.
start "" http://localhost:8000
.venv\Scripts\python -m uvicorn may_chu:app --port 8000
goto :eof
:loi
echo Cai dat chua thanh cong. Kiem tra da cai Python va co mang.
pause
