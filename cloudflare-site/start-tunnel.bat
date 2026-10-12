@echo off
cd /d "%~dp0"
echo Запускаю сайт (общий таймер + онлайн)...
start "AG site http://localhost:8000" python server.py
timeout /t 3 /nobreak >nul
echo Открываю туннель trycloudflare (ссылку скопируй из окна)...
cloudflared.exe tunnel --url http://localhost:8000
pause
