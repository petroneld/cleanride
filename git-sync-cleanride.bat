@echo off
cls
echo ===========================================
echo    CleanRide - Git Auto Sync Script
echo ===========================================
echo.

REM Verifica daca suntem intr-un repo Git
git rev-parse --is-inside-work-tree >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Nu esti intr-un repository Git.
    echo Ruleaza scriptul din folderul proiectului.
    pause
    exit /b
)

echo ✔ Repo detectat.

REM Sterge remote origin vechi, daca exista
git remote remove origin 2>nul
echo ✔ Remote 'origin' resetat.

REM Adauga remote corect
git remote add origin https://github.com/petroneld/cleanride.git
echo ✔ Remote corect setat: https://github.com/petroneld/cleanride.git

REM Adauga orice modificare
git add .

REM Verifica daca exista ceva de commit
git diff-index --quiet HEAD --
IF %ERRORLEVEL% NEQ 0 (
    echo ✔ Exista modificari. Fac commit...
    git commit -m "Auto sync from script"
) ELSE (
    echo ℹ Nu exista modificari noi. Trec direct la push.
)

echo.
echo ✔ Pornim push-ul catre GitHub...
git push -u origin main

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Eroare la push.
    echo Verifica daca repo-ul exista pe GitHub si autentificarea este valida.
    pause
    exit /b
)

echo.
echo ===========================================
echo     🎉 SUCCES! Codul este pe GitHub!
echo ===========================================
echo Viziteaza: https://github.com/petroneld/cleanride
echo.
pause
