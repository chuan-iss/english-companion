Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = root
' Start the companion first with Start.vbs, then invoke this action while Chrome has focus.
sh.SendKeys "^+y"
