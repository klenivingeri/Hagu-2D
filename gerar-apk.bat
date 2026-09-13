@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  HAGU - Gerando APK de teste (debug)
echo ============================================

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set JAVA_OPTS=-Djava.net.preferIPv4Stack=true

echo.
echo [1/3] Build do jogo (npm run build)...
call npm run build
if errorlevel 1 goto erro

echo.
echo [2/3] Copiando build para o projeto Android (cap sync)...
call npx cap sync android
if errorlevel 1 goto erro

echo.
echo [3/3] Compilando o APK (gradlew assembleDebug)...
cd /d "%~dp0android"
call "%~dp0android\gradlew.bat" assembleDebug
if errorlevel 1 goto erro_gradle
cd /d "%~dp0"

echo.
echo ============================================
echo  APK gerado com sucesso!
echo  android\app\build\outputs\apk\debug\app-debug.apk
echo ============================================
pause
exit /b 0

:erro_gradle
cd /d "%~dp0"

:erro
echo.
echo ============================================
echo  ALGO DEU ERRADO. Veja a mensagem acima.
echo ============================================
pause
exit /b 1
