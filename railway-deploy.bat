@echo off
setlocal enabledelayedexpansion
cls
echo ===========================================
echo        CleanRide - Railway Deploy Script
echo ===========================================
echo.

REM Ensure we keep the window open in VS Code
call :check_git
call :check_railway
call :railway_login
call :railway_init
call :set_env_vars
call :deploy

echo.
echo ===========================================
echo        DONE! DEPLOY COMPLET
echo ===========================================
railway url
echo.
pause
exit /b

:: ============================
:: FUNCTIONS
:: ============================

:check_git
echo ✔ Verific repo Git...
git rev-parse --is-inside-work-tree >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Nu esti intr-un repository Git!
    pause
    exit /b
)
echo ✔ Repo Git detectat.
echo.
exit /b

:check_railway
echo ✔ Verific Railway CLI...
call railway --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Railway CLI nu este instalat.
    echo ➤ Instalez Railway CLI global...
    call npm install -g railway
)
echo ✔ Railway CLI este instalat.
echo.
exit /b

:railway_login
echo ➤ Autentificare Railway...
call railway login
echo ✔ Login Railway complet.
echo.
exit /b

:railway_init
echo ➤ Initializare proiect Railway...
call railway init
echo ✔ Railway init OK.
echo.
exit /b

:set_env_vars
echo ➤ Setez variabilele .env in Railway...

IF NOT EXIST ".env" (
    echo ❌ Fisier .env lipseste!
    pause
    exit /b
)

for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    echo   → Setez %%a
    call railway variables set %%a="%%b" >nul
)

echo ✔ Variabile trimise catre Railway.
echo.
exit /b

:deploy
echo ➤ Deploy in curs...
call railway up
exit /b
