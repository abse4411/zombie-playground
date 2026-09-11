@echo off
chcp 65001 >nul
title 丧尸游乐场 · Zombie Playground
start "" "%~dp0index.html"
echo 游戏已在默认浏览器中打开，祝狩猎愉快！
timeout /t 2 >nul
