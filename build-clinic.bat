@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - build the bundle (Windows)
REM
REM  Run this ONCE on the clinic PC after copying the project across, and
REM  again whenever the code changes. It needs the internet, because it
REM  downloads Python and Node packages. Running the clinic afterwards does
REM  not: start-clinic.bat works entirely offline.
REM
REM  Needs Python 3.11+ and Node 20+ already installed.
REM ===========================================================================

setlocal
cd /d "%~dp0"

echo.
echo  [1/6] Python environment
if not exist "backend\venv\Scripts\python.exe" (
    python -m venv backend\venv
    if errorlevel 1 goto :nopython
)
backend\venv\Scripts\python.exe -m pip install --upgrade pip --quiet
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt --quiet
if errorlevel 1 goto :failed

echo  [2/6] Frontend packages
cd frontend
call npm install --silent
if errorlevel 1 goto :failed

echo  [3/6] Building the web app
call npm run build
if errorlevel 1 goto :failed
cd ..

echo  [4/6] Settings file
backend\venv\Scripts\python.exe backend\make_env.py
if errorlevel 1 goto :failed

echo  [5/6] Database
backend\venv\Scripts\python.exe backend\manage.py migrate
if errorlevel 1 goto :failed

REM Creates the dentist login, clinic details and working hours on a fresh
REM database. Leaves an existing clinic's data alone, so rebuilding is safe.
backend\venv\Scripts\python.exe backend\manage.py seed_clinic
if errorlevel 1 goto :failed

echo  [6/6] Collecting files to serve
set DEBUG=False
REM A throwaway key just for collectstatic - the real one is in backend\.env
REM and settings.py refuses to start without it.
set SECRET_KEY=build-step-only-not-used-at-runtime-aaaaaaaaaaaaaaaaaaaa
backend\venv\Scripts\python.exe backend\manage.py collectstatic --noinput --clear
if errorlevel 1 goto :failed

echo.
echo  ==========================================================
echo   Build complete. Start the clinic with: start-clinic.bat
echo  ==========================================================
echo.
pause
exit /b 0

:nopython
echo.
echo  ERROR: Python was not found.
echo  Install Python 3.11 or newer from python.org and tick
echo  "Add Python to PATH" during setup, then run this again.
echo.
pause
exit /b 1

:failed
echo.
echo  BUILD FAILED - see the messages above.
echo.
pause
exit /b 1
