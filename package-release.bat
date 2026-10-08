@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - cut a release (developer machine only)
REM
REM  Builds the app, then zips backend\ + frontend\dist\ into
REM  release-v<VERSION>.zip at the repo root. That zip is exactly what
REM  backend\update_check.py looks for as a GitHub release asset and
REM  installs on clinic PCs - so its layout matters: this produces a zip
REM  whose top level is backend\ and frontend\ directly (no wrapping folder).
REM
REM  Version: read from the VERSION file at the repo root by default, or
REM  pass one explicitly:   package-release.bat 1.2.0
REM  (this does NOT write the VERSION file - bump it yourself first, or pass
REM  the new number here; update_check.py updates a clinic PC's VERSION file
REM  only after it installs this release).
REM
REM  Needs the internet and Python/Node already installed, same as
REM  build-clinic.bat (which this calls). Does NOT publish anything - it
REM  only prints the `gh release create` command for you to run yourself,
REM  since publishing a public release is your call to make.
REM ===========================================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

if not "%~1"=="" (
    set VERSION=%~1
) else (
    set /p VERSION=<VERSION
)

if "%VERSION%"=="" goto :noversion

echo.
echo  Packaging release v%VERSION%
echo  ============================
echo.

echo  [1/4] Building the app (needs internet)
call build-clinic.bat
if errorlevel 1 goto :failed

set STAGING=dist-release\staging
if exist "%STAGING%" rmdir /s /q "%STAGING%"
mkdir "%STAGING%\backend" 2>nul
mkdir "%STAGING%\frontend" 2>nul

echo  [2/4] Copying backend source (excluding secrets, database, local env)
REM robocopy exit codes 0-7 are success (various "something was copied" /
REM "nothing to do" combinations); 8+ means a real failure.
robocopy backend "%STAGING%\backend" /E /XD venv media __pycache__ /XF .env db.sqlite3 *.pyc >nul
if errorlevel 8 goto :failed

echo  [3/4] Copying the built frontend
robocopy frontend\dist "%STAGING%\frontend\dist" /E >nul
if errorlevel 8 goto :failed

echo  [4/4] Zipping
set ZIPNAME=release-v%VERSION%.zip
if exist "%ZIPNAME%" del "%ZIPNAME%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Compress-Archive -Path '%STAGING%\backend','%STAGING%\frontend' -DestinationPath '%ZIPNAME%' -Force"
if errorlevel 1 goto :failed

rmdir /s /q "%STAGING%"

echo.
echo  ==========================================================
echo   Built: %ZIPNAME%
echo.
echo   This did NOT publish anything. To publish it as the release
echo   clinic PCs will auto-update to, run:
echo.
echo     gh release create v%VERSION% %ZIPNAME% --title "v%VERSION%" --notes "Release v%VERSION%"
echo.
echo  ==========================================================
echo.
pause
exit /b 0

:noversion
echo.
echo  ERROR: no version found. Put a version number in the VERSION file,
echo  or pass one as an argument:   package-release.bat 1.2.0
echo.
pause
exit /b 1

:failed
echo.
echo  PACKAGING FAILED - see the messages above.
echo.
pause
exit /b 1
