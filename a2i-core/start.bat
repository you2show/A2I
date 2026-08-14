@echo off
REM A2I Core - ONE command to a working local AI on Windows.
REM
REM Sets up Python, downloads an open model if needed, and starts the server.
REM Inference runs on NATIVE llama.cpp - not the browser's WebAssembly - so it
REM works reliably, with no external API. Chat opens at:
REM
REM     http://127.0.0.1:8990
REM
REM Usage:  double-click this file, or run  start.bat  in a terminal.
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "A2I_URL=http://127.0.0.1:8990"

echo.
echo ========================================================
echo   A2I Local-Only Setup ^& Launcher
echo ========================================================
echo.

netstat -ano | findstr ":8990" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo A process is already listening on port 8990.
  echo Opening %A2I_URL% in your browser...
  start "" "%A2I_URL%"
  echo.
  echo If the page still cannot open, close the other process and run this file again.
  pause
  exit /b 0
)

REM Prefer `python` when it is available, but the official Windows installer
REM also provides the `py` launcher. This works when Python is installed but
REM `python.exe` was not added to PATH.
set "PYTHON_CMD="
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
  py -3.11 -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=py -3.11"
)
if not defined PYTHON_CMD (
  echo Error: Python 3.10 or newer was not found.
  echo Install Python 3.11 from https://python.org, then run this file again.
  pause
  exit /b 1
)
echo Using %PYTHON_CMD%

if not exist .venv\Scripts\python.exe (
  echo Setting up Python environment ^(first run only^) ...
  %PYTHON_CMD% -m venv .venv
)

REM A previous interrupted setup can leave a .venv folder without llama.cpp.
REM Verify the runtime on every launch; install a prebuilt CPU wheel when needed.
.venv\Scripts\python -c "import llama_cpp, fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
  echo Installing A2I local runtime ^(first run only^) ...
  .venv\Scripts\python -m pip install --quiet --upgrade pip
  .venv\Scripts\pip install --prefer-binary -r requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
  if errorlevel 1 (
    echo.
    echo A2I could not install its prebuilt local runtime.
    echo Check your internet connection, then run this file again.
    echo If the error says no matching wheel, send the full error text to A2I support.
    pause
    exit /b 1
  )
)

if not exist models\model.gguf (
  echo No active local model found.
  echo Installing the verified Qwen2.5 3B default once to A2I Model Library ^(~2.1 GB^) ...
  echo Future models are stored in models\library and are not downloaded again.
  .venv\Scripts\python model_manager.py install-default
  if errorlevel 1 (
    echo Local model download or activation failed. Check your internet connection and re-run.
    pause
    exit /b 1
  )
)

echo.
echo --------------------------------------------------------
echo   A2I Core is starting - open  http://127.0.0.1:8990
echo   ^(native llama.cpp - 100%% local - no external API^)
echo --------------------------------------------------------
echo.
.venv\Scripts\python server.py --open-browser %*
set "A2I_EXIT=%ERRORLEVEL%"
echo.
echo ========================================================
echo   A2I Core stopped with exit code %A2I_EXIT%.
echo ========================================================
echo.
echo Keep this window open and copy the error text if you need help.
pause
exit /b %A2I_EXIT%
