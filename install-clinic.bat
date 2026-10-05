@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - OFFLINE install (Windows)
REM
REM  Downloads nothing. No internet needed, no Node needed.
REM
REM  Everything it installs is already in this folder:
REM    vendor\wheels    - the Python packages
REM    frontend\dist    - the web app, already built
REM
REM  Only requirement: Python 3.11 or newer, with "Add Python to PATH"
REM  ticked during its setup.
REM
REM  Run this once. Then use start-clinic.bat every day.
REM ===========================================================================

setlocal
cd /d "%~dp0"

echo.
echo  Dr. Belin's Dentistry - offline install
echo  =======================================
echo.

where python >nul 2>&1
if errorlevel 1 goto :nopython

if not exist "vendor\wheels" goto :nowheels
if not exist "frontend\dist\index.html" goto :nodist

echo  [1/5] Creating the Python environment
if not exist "backend\venv\Scripts\python.exe" (
    REM venv uses the pip bundled inside Python itself - no download.
    python -m venv backend\venv
    if errorlevel 1 goto :nopython
)

echo  [2/5] Installing packages from vendor\wheels
REM --no-index is the important part: pip is forbidden from contacting the
REM internet and must satisfy everything from the local folder. If a package
REM were missing this fails loudly here rather than silently reaching out.
backend\venv\Scripts\python.exe -m pip install --no-index --find-links=vendor\wheels -r backend\requirements-clinic.txt --quiet --disable-pip-version-check
if errorlevel 1 goto :pipfailed

echo  [3/5] Creating the settings file
backend\venv\Scripts\python.exe backend\make_env.py
if errorlevel 1 goto :failed

echo  [4/5] Preparing the database
backend\venv\Scripts\python.exe backend\manage.py migrate --noinput
if errorlevel 1 goto :failed
REM Dentist login, clinic details and working hours. Leaves an existing
REM clinic's data alone, so re-running this is safe.
backend\venv\Scripts\python.exe backend\manage.py seed_clinic
if errorlevel 1 goto :failed

echo  [5/5] Collecting the web files
REM Copies frontend\dist into backend\staticfiles. Local file copying only.
set DEBUG=False
set SECRET_KEY=setup-step-only-not-used-at-runtime-aaaaaaaaaaaaaaaaaaaaaa
backend\venv\Scripts\python.exe backend\manage.py collectstatic --noinput --clear
if errorlevel 1 goto :failed

echo.
echo  ==========================================================
echo   Installed. Nothing was downloaded.
echo.
echo   Start the clinic software with:  start-clinic.bat
echo.
echo   Then sign in at http://localhost:8000/clinic/login
echo     Username:  drbelin
echo     Password:  change-this-password
echo.
echo   CHANGE THAT PASSWORD. It is a public default:
echo     backend\venv\Scripts\python.exe backend\manage.py changepassword drbelin
echo  ==========================================================
echo.
pause
exit /b 0

:nopython
echo.
echo  ERROR: Python was not found on this PC.
echo.
echo  Install Python 3.11 or newer from python.org, and tick
echo  "Add Python to PATH" on the first screen of its installer.
echo  Then run this file again.
echo.
pause
exit /b 1

:nowheels
echo.
echo  ERROR: the vendor\wheels folder is missing.
echo  This copy of the project is incomplete - re-download it in full.
echo.
pause
exit /b 1

:nodist
echo.
echo  ERROR: frontend\dist is missing, so the web app has not been built.
echo  This copy of the project is incomplete - re-download it in full.
echo.
pause
exit /b 1

:pipfailed
echo.
echo  ERROR: a Python package could not be installed from vendor\wheels.
echo  Nothing was downloaded - that is deliberate. The folder is likely
echo  incomplete, so re-download the project in full.
echo.
pause
exit /b 1

:failed
echo.
echo  INSTALL FAILED - see the messages above.
echo.
pause
exit /b 1
