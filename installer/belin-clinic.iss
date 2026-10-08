; ===========================================================================
;  Dr. Belin's Dentistry - Windows installer (Inno Setup 6)
;
;  Packages the already-built offline bundle (embedded Python ingredients in
;  vendor\, the backend source, the built frontend) and - as a post-install
;  step - runs install-clinic.bat itself, so the clinic PC is immediately
;  ready the moment setup finishes: embedded Python unpacked, backend\.env
;  created, database migrated and seeded. No second manual step.
;
;  Build this with build-installer.bat at the repo root (it runs
;  build-clinic.bat first, then compiles this script). To compile by hand:
;    ISCC installer\belin-clinic.iss
;  optionally with  /DMyAppVersion=1.2.0  to stamp a specific version - see
;  the #ifndef guard below, which otherwise defaults to 1.0.0.
;
;  Install location: {localappdata}\BelinClinic, with PrivilegesRequired=
;  lowest (no admin rights, no UAC prompt). This is daily-use clinic
;  software, not an admin tool, and install-clinic.bat / start-clinic.bat
;  both need write access to their own folder every time they run (runtime\,
;  backend\.env, backend\db.sqlite3, backend\staticfiles) - Program Files
;  would need elevation for that on every run, which a receptionist's PC
;  should not require.
;
;  Uninstalling removes only what THIS installer put down - the files listed
;  in [Files] below and the shortcuts in [Icons]. It deliberately does NOT
;  list backend\.env, backend\db.sqlite3, backend\media\ or runtime\ (all of
;  those are created later, by install-clinic.bat, not by this installer),
;  so Inno Setup's uninstaller has no record of them and cannot delete them.
;  Inno also only removes the install folder itself if it ends up empty, so
;  with the clinic's real data still sitting in it, the folder - and the
;  data - is left behind automatically. CurUninstallStepChanged below just
;  tells the person that, rather than silently going quiet about where their
;  patient records went.
; ===========================================================================

#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
#define MyAppName "Belin Clinic"
#define MyAppPublisher "Dr. Belin's Dentistry"

[Setup]
AppId={{4F2B8E7A-9C3D-4A61-8E2F-7B1D5C9A3E02}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\BelinClinic
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=BelinClinicSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\start-clinic.bat
DisableReadyPage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
; Launcher scripts and the version marker.
Source: "..\install-clinic.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\start-clinic.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\VERSION"; DestDir: "{app}"; Flags: ignoreversion

; Embedded Python + the pure-Python wheels - what install-clinic.bat unpacks
; at setup time. No internet needed on the clinic PC because this is all
; already here.
Source: "..\vendor\*"; DestDir: "{app}\vendor"; Flags: ignoreversion recursesubdirs createallsubdirs

; The built web app.
Source: "..\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Backend source only - never the local secrets, the patient database, the
; uploaded documents, or a developer's own virtualenv. Matches the exclusion
; list in backend\update_check.py and package-release.bat.
Source: "..\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".env,db.sqlite3,media,venv,__pycache__,*.pyc"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start-clinic.bat"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start-clinic.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Runs the existing install-clinic.bat exactly as a person would by hand -
; unpacks the embedded Python, writes backend\.env, migrates and seeds the
; database, collects static files. BELIN_SILENT tells it to skip its normal
; "press any key" pauses, since nothing here can press a key; it still shows
; those pauses when a person double-clicks install-clinic.bat themselves.
Filename: "{cmd}"; Parameters: "/c set BELIN_SILENT=1&&call ""{app}\install-clinic.bat"""; WorkingDir: "{app}"; Flags: runascurrentuser waituntilterminated; StatusMsg: "Setting up the clinic software - this can take a minute..."

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if DirExists(ExpandConstant('{app}')) then
      MsgBox(
        'The clinic''s patient database, uploaded files, and settings were left in:' + #13#10 +
        ExpandConstant('{app}') + #13#10#13#10 +
        'Nothing there was deleted. Remove that folder yourself only if you are certain it is no longer needed.',
        mbInformation, MB_OK);
  end;
end;
