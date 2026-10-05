@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - start the clinic software (Windows)
REM
REM  Double-click this. Works completely offline.
REM  Leave this window open while the clinic is using the software;
REM  closing it stops the server.
REM
REM  Run install-clinic.bat first, once.
REM ===========================================================================

setlocal
cd /d "%~dp0"

set PY=runtime\python\python.exe
set PORT=8000
REM This PC only. Patient records should not be reachable from the rest of the
REM clinic network by default. To let another machine (say, reception) connect,
REM set LISTEN to 0.0.0.0 AND add this PC's LAN address to ALLOWED_HOSTS in
REM backend\.env - Django rejects a host it has not been told about.
set LISTEN=127.0.0.1

if not exist "%PY%" goto :notinstalled
if not exist "backend\.env" goto :notinstalled
if not exist "backend\staticfiles" goto :notinstalled

REM Applies any database changes that came with a new version. Does nothing
REM when there are none, so a staff member never has to run a command.
"%PY%" backend\manage.py migrate --noinput

start "" http://localhost:%PORT%

"%PY%" backend\run_server.py

echo.
echo  The clinic software has stopped.
pause
exit /b 0

:notinstalled
echo.
echo  The software has not been installed yet on this PC.
echo.
echo  Run install-clinic.bat first - it only needs doing once,
echo  and it does not need the internet.
echo.
pause
exit /b 1
