#!/usr/bin/env bash
set -euo pipefail
mkdir -p out
echo "Compiling SiteFit..."
javac -encoding UTF-8 -d out src/main/java/com/sitefit/SiteFitServer.java
echo "Starting SiteFit..."
java -cp out com.sitefit.SiteFitServer
