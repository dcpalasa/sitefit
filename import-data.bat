@echo off
setlocal
if "%~1"=="" (
  echo Usage: import-data.bat path\to\Sales_Export.xlsx
  exit /b 1
)
python scripts\import_crexi.py "%~1"
