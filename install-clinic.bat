@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - install (Windows)
REM
REM  Downloads NOTHING and needs nothing installed on this PC.
REM  No internet, no Python, no Node.
REM
REM  Everything is already in this folder:
REM    vendor\python-*-embed-amd64.zip  - Python itself
REM    vendor\wheels\                   - the Python packages
REM    frontend\dist\                   - the web app, already built
REM
REM  Run this once. Then use start-clinic.bat every day.
REM ===========================================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set PYZIP=vendor\python-3.12.10-embed-amd64.zip
set RUNTIME=runtime
set PY=%RUNTIME%\python\python.exe

echo.
echo  Dr. Belin's Dentistry - install
echo  ===============================
echo.

if not exist "%PYZIP%" goto :incomplete
if not exist "vendor\wheels" goto :incomplete
if not exist "frontend\dist\index.html" goto :incomplete

echo  [1/6] Unpacking Python
if not exist "%PY%" (
    if exist "%RUNTIME%\python" rmdir /s /q "%RUNTIME%\python"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "Expand-Archive -LiteralPath '%PYZIP%' -DestinationPath '%RUNTIME%\python' -Force"
    if errorlevel 1 goto :failed
)
if not exist "%PY%" goto :failed

echo  [2/6] Pointing Python at the bundled packages
REM python312._pth replaces the usual sys.path. Paths are relative to the
REM folder holding python.exe. Without ..\..\backend the interpreter cannot
REM import config.settings, because a path file also turns off the automatic
REM "script's own directory" entry.
> "%RUNTIME%\python\python312._pth" echo python312.zip
>> "%RUNTIME%\python\python312._pth" echo .
>> "%RUNTIME%\python\python312._pth" echo ..\lib
>> "%RUNTIME%\python\python312._pth" echo ..\..\backend
>> "%RUNTIME%\python\python312._pth" echo import site

echo  [3/6] Installing packages
REM A wheel is a zip laid out exactly as site-packages expects, and every
REM dependency here is pure Python, so extracting them IS the install. The
REM embeddable Python has no pip and bootstrapping one would need the network.
"%PY%" vendor\unpack_wheels.py "%CD%\%RUNTIME%\lib"
if errorlevel 1 goto :failed

echo  [4/6] Creating the settings file
"%PY%" backend\make_env.py
if errorlevel 1 goto :failed

echo  [5/6] Preparing the database
"%PY%" backend\manage.py migrate --noinput
if errorlevel 1 goto :failed
REM Dentist login, clinic details and working hours. Leaves an existing
REM clinic's data alone, so re-running this is safe.
"%PY%" backend\manage.py seed_clinic
if errorlevel 1 goto :failed

echo  [6/6] Collecting the web files
set DEBUG=False
set SECRET_KEY=setup-step-only-not-used-at-runtime-aaaaaaaaaaaaaaaaaaaaaa
"%PY%" backend\manage.py collectstatic --noinput --clear
if errorlevel 1 goto :failed

echo.
echo  ==========================================================
echo   Installed. Nothing was downloaded.
echo.
echo   Start the clinic software:  start-clinic.bat
echo.
echo   Then sign in at http://localhost:8000/clinic/login
echo     Username:  drbelin
echo     Password:  change-this-password
echo.
echo   CHANGE THAT PASSWORD - it is a public default:
echo     runtime\python\python.exe backend\manage.py changepassword drbelin
echo  ==========================================================
echo.
pause
exit /b 0

:incomplete
echo.
echo  ERROR: this copy of the project is incomplete.
echo.
echo  Expected to find:
echo    %PYZIP%
echo    vendor\wheels\
echo    frontend\dist\index.html
echo.
echo  Download the project again, in full.
echo.
pause
exit /b 1

:failed
echo.
echo  INSTALL FAILED - see the messages above.
echo.
pause
exit /b 1
