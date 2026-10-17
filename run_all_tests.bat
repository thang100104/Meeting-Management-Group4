@echo off
chcp 65001 > nul
echo =====================================================================
echo 🏢 MEETING MANAGEMENT SYSTEM (GROUP 4) - MASTER TEST RUNNER
echo =====================================================================
echo.
python "%~dp0run_all_tests.py"
echo.
pause
