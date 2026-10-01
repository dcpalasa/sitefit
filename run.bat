@echo off
setlocal

if not exist out mkdir out

echo Compiling SiteFit...
javac -encoding UTF-8 -d out src\main\java\com\sitefit\SiteFitServer.java
if errorlevel 1 (
  echo.
  echo Compilation failed. Make sure JDK 21 or newer is installed and java/javac are on PATH.
  exit /b 1
)

echo Starting SiteFit...
java -cp out com.sitefit.SiteFitServer
