@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - start the clinic software (Windows)
REM
REM  Double-click this. One server, one port, no internet needed.
REM  Leave this window open while the clinic is using the software; closing
REM  it stops the server.
REM
REM  Run build-clinic.bat first, once.
REM
REM  Waitress, not gunicorn: gunicorn depends on the fcntl module, which does
REM  not exist on Windows. Waitress is the production-grade equivalent that
REM  does run here.
REM ===========================================================================

setlocal
cd /d "%~dp0"

set PORT=8000

if not exist "backend\venv\Scripts\python.exe" goto :nobuild
if not exist "frontend\dist\index.html" goto :nobuild
if not exist "backend\.env" goto :noenv

echo.
echo  ==========================================================
echo    Dr. Belin's Dentistry
echo.
echo    Clinic software:  http://localhost:%PORT%
echo    Staff login:      http://localhost:%PORT%/clinic/login
echo.
echo    Keep this window open. Close it to stop the software.
echo  ==========================================================
echo.

REM Apply any database changes that shipped with a new version. Harmless when
REM there are none, and it means a staff member never has to run a command.
backend\venv\Scripts\python.exe backend\manage.py migrate --noinput

start "" http://localhost:%PORT%

REM Bound to this PC only. Patient records should not be reachable from
REM anywhere else on the clinic network by default. To let a second
REM machine (say, reception) connect, change LISTEN to 0.0.0.0 AND add
REM this PC's LAN address to ALLOWED_HOSTS in backend\.env - Django
REM rejects a host it has not been told about.
set LISTEN=127.0.0.1

cd backend
venv\Scripts\waitress-serve.exe --host=%LISTEN% --port=%PORT% config.wsgi:application

echo.
echo  The clinic software has stopped.
pause
exit /b 0

:nobuild
echo.
echo  The software has not been built yet.
echo  Run build-clinic.bat first - it only needs doing once.
echo.
pause
exit /b 1

:noenv
echo.
echo  backend\.env is missing.
echo  Copy backend\.env.example to backend\.env and fill it in
echo  (SECRET_KEY and DEBUG=False at minimum), then try again.
echo.
pause
exit /b 1
