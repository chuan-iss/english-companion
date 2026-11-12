$env:EN_TOOL_UI_TEST='1'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$taskRoot=(Resolve-Path "$PSScriptRoot\..").Path
Start-Process -FilePath "$taskRoot\node_modules\electron\dist\electron.exe" -ArgumentList ('"' + $taskRoot + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput "$taskRoot\.runtime\electron-out.log" -RedirectStandardError "$taskRoot\.runtime\electron-error.log" -Wait
