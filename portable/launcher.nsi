Unicode true
Name "KEROPPILOT"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
SetCompressor zlib
Icon "${APP_ICON}"
OutFile "${OUTPUT_EXE}"

Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\app"
  ClearErrors
  File /r "${RUNTIME_DIR}\*"
  IfErrors unpack_failed
  ExecWait '"$PLUGINSDIR\app\KEROPPILOT.exe"' $0
  IfErrors launch_failed
  SetErrorLevel $0
  Quit
  unpack_failed:
    MessageBox MB_ICONSTOP "无法解压运行文件，请确认临时目录有足够空间。"
    SetErrorLevel 1
    Quit
  launch_failed:
    MessageBox MB_ICONSTOP "无法启动 KEROPPILOT。请在 Windows 10 或 11 的 x64 系统上运行。"
    SetErrorLevel 1
SectionEnd
