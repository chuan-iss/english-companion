Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = root
sh.Environment("PROCESS").Remove "ELECTRON_RUN_AS_NODE"
sh.Environment("PROCESS").Remove "EN_TOOL_UI_TEST"
sh.Environment("PROCESS").Remove "EN_TOOL_LIVE_TEST"
sh.Run Chr(34) & root & "\node_modules\electron\dist\electron.exe" & Chr(34) & " " & Chr(34) & root & Chr(34), 1, False
