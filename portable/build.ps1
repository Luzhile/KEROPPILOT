$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$version = '45.5.0'
$sha256 = '20155c8b8aa5b1f575f3757bdf21490e0bac2f19a65a26ce9ba99bcf9f2c69bd'
$work = Join-Path $root 'src-tauri/target/electron-portable'
$runtime = Join-Path $work ('build-' + [guid]::NewGuid().ToString('N'))
$zipName = "electron-v$version-win32-x64.zip"
$zip = Join-Path $work $zipName
$out = Join-Path $root 'release/KEROPPILOT-Windows-x64.exe'
$icon = Join-Path $root 'src-tauri/icons/icon.ico'
$compiler = Join-Path $env:LOCALAPPDATA 'tauri/NSIS/makensis.exe'
if (!(Test-Path -LiteralPath $compiler)) { $compiler = (Get-Command makensis.exe).Source }
New-Item -ItemType Directory -Force -Path $runtime,(Split-Path $out) | Out-Null
if (!(Test-Path -LiteralPath $zip)) {
    curl.exe -fsSL --retry 2 "https://github.com/electron/electron/releases/download/v$version/$zipName" -o $zip
    if ($LASTEXITCODE) { throw 'Electron download failed' }
}
if ((Get-FileHash -LiteralPath $zip).Hash -ne $sha256) { throw 'Electron checksum mismatch' }
tar.exe -xf $zip -C $runtime
if ($LASTEXITCODE) { throw 'Electron extraction failed' }
Rename-Item -LiteralPath (Join-Path $runtime 'electron.exe') -NewName 'KEROPPILOT.exe'
$appDir = Join-Path $runtime 'resources/app'
New-Item -ItemType Directory -Path $appDir | Out-Null
Push-Location $root
try {
    npm.cmd run build
    if ($LASTEXITCODE) { throw 'Frontend build failed' }
} finally { Pop-Location }
Copy-Item -LiteralPath (Join-Path $root 'dist') -Destination $appDir -Recurse
Copy-Item -LiteralPath $icon -Destination (Join-Path $appDir 'icon.ico')
foreach ($file in @('main.cjs', 'preload.cjs', 'package.json')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $appDir
}
& $compiler /V2 /INPUTCHARSET UTF8 "/DAPP_ICON=$icon" "/DRUNTIME_DIR=$runtime" "/DOUTPUT_EXE=$out" (Join-Path $PSScriptRoot 'launcher.nsi')
if ($LASTEXITCODE) { throw 'EXE packaging failed' }
Get-Item -LiteralPath $out | Select-Object FullName,Length
