Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트 경로
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 서버 시작 (숨김 모드)
WshShell.CurrentDirectory = scriptPath
WshShell.Run "node src/server.js", 0, False

' 2초 대기
WScript.Sleep 2000

' 브라우저 열기
WshShell.Run "http://localhost:54112"
