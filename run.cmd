@echo off
setlocal

rem AgOpenWeb - build the desktop app and start it.
rem
rem Usage:
rem   run.cmd
rem       Build, then open the normal launcher window. Classic stays the
rem       default; switch with Menu > User Interface > Modern UI.
rem
rem   run.cmd modern
rem       Build, start the headless host in its own console, and open the
rem       Modern UI in the default browser.
rem
rem   run.cmd build
rem       Build only, then exit.
rem
rem   run.cmd <args>
rem       Any other first argument is passed to the app, e.g. --headless.
rem
rem Build output: Platforms\AgOpenWeb.Desktop\bin\Debug\net10.0\
rem Stop a headless host with Ctrl+C in its console window.

set "ROOT=%~dp0"
set "PROJECT=%ROOT%Platforms\AgOpenWeb.Desktop\AgOpenWeb.Desktop.csproj"
set "MODE=%~1"

pushd "%ROOT%" || goto noroot

where dotnet >nul 2>&1
if errorlevel 1 goto nodotnet

echo.
echo === Building AgOpenWeb (Debug) ===
echo.
rem DesktopOnly=true keeps the shared VirtualTerminal project on net10.0, so the
rem script does not need the Android/iOS workloads just to run the desktop app.
dotnet build "%PROJECT%" -c Debug -v:m -nologo -p:DesktopOnly=true
if errorlevel 1 goto buildfailed

if /i "%MODE%"=="build" goto built
if /i "%MODE%"=="modern" goto modern

echo.
echo === Starting AgOpenWeb ===
echo.
dotnet run --project "%PROJECT%" -c Debug --no-build -p:DesktopOnly=true -- %*
set "CODE=%errorlevel%"
popd
if not "%CODE%"=="0" goto runfailed
exit /b 0

:built
echo.
echo Build complete: %ROOT%Platforms\AgOpenWeb.Desktop\bin\Debug\net10.0\
popd
exit /b 0

:modern
echo.
echo === Starting AgOpenWeb headless ===
echo UI: http://localhost:5174/?ui=modern
echo Close the "AgOpenWeb headless" console to stop the host.
echo.
start "AgOpenWeb headless" cmd /k dotnet run --project "%PROJECT%" -c Debug --no-build -p:DesktopOnly=true -- --headless
echo Waiting for the host to come up...
timeout /t 8 /nobreak >nul
start "" "http://localhost:5174/?ui=modern"
popd
exit /b 0

:noroot
echo Could not open the repository folder:
echo   %ROOT%
goto endfailed

:nodotnet
echo.
echo The .NET SDK was not found on PATH.
echo Install .NET 10 (see BUILD.md) and open a new console.
goto endfailed

:buildfailed
echo.
echo Build failed. Fix the errors above and run this script again.
goto endfailed

:runfailed
echo.
echo AgOpenWeb exited with code %CODE%.
goto endfailed

:endfailed
popd 2>nul
echo.
pause
exit /b 1
