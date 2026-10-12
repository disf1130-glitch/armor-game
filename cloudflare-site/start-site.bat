@echo off
cd /d "%~dp0"
echo ====================================
echo  Armor Game site: http://localhost:8000
echo  Закрой это окно чтобы остановить
echo ====================================
python -m http.server 8000
pause
