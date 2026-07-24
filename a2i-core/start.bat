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

where python >nul 2>nul
if errorlevel 1 (
  echo Error: Python 3 is not installed.
  echo Install it from https://python.org ^(tick "Add python.exe to PATH"^), then re-run.
  pause
  exit /b 1
)

if not exist .venv (
  echo Setting up Python environment ^(first run only^) ...
  python -m venv .venv
  .venv\Scripts\python -m pip install --quiet --upgrade pip
  .venv\Scripts\pip install -r requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
  if errorlevel 1 (
    echo Prebuilt wheel unavailable - building from source ^(needs Visual C++ Build Tools^) ...
    .venv\Scripts\pip install -r requirements.txt
  )
)

if not exist models\model.gguf (
  echo No model found - downloading one now ^(one-time, ~1 GB^) ...
  if not exist models mkdir models
  curl -L --fail -o models\model.gguf "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
  if errorlevel 1 (
    echo Download failed. Check your internet connection and re-run.
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
.venv\Scripts\python server.py %*
