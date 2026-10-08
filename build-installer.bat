@echo off
REM ===========================================================================
REM  Dr. Belin's Dentistry - build the Windows installer .exe (developer)
REM
REM  Chains: build the app (build-clinic.bat) -> compile the Inno Setup
REM  installer (installer\belin-clinic.iss) -> prints where the .exe landed.
REM
REM  Needs Inno Setup's compiler (ISCC.exe) installed:
REM    winget install JRSoftware.InnoSetup
REM  or download it from https://jrsoftware.org/isdl.php
REM
REM  The installer is stamped with the version in the VERSION file.
REM ===========================================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  [1/2] Building the app (needs internet)
call "%~dp0build-clinic.bat"
if errorlevel 1 goto :failed

echo  [2/2] Compiling the installer
set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC% set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
if not exist %ISCC% set ISCC="%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if exist %ISCC% goto :haveiscc

where ISCC >nul 2>nul
if errorlevel 1 goto :noiscc
set ISCC=ISCC

:haveiscc
set /p INSTALLER_VERSION=<VERSION
%ISCC% /DMyAppVersion=%INSTALLER_VERSION% installer\belin-clinic.iss
if errorlevel 1 goto :failed

echo.
echo  ==========================================================
echo   Installer built: installer\Output\BelinClinicSetup.exe
echo  ==========================================================
echo.
pause
exit /b 0

:noiscc
echo.
echo  Inno Setup's compiler (ISCC.exe) was not found on this machine.
echo.
echo  Install it, then run this again:
echo    winget install JRSoftware.InnoSetup
echo  or download it from https://jrsoftware.org/isdl.php
echo.
echo  installer\belin-clinic.iss is already written and ready to compile
echo  as soon as Inno Setup is installed - nothing else to do first.
echo.
pause
exit /b 1

:failed
echo.
echo  BUILD FAILED - see the messages above.
echo.
pause
exit /b 1
