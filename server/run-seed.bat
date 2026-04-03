@echo off
REM Script to run seed.sql against Neon PostgreSQL database (Windows)
REM Reads DATABASE_URL from .env file

echo Loading environment from .env file...

REM Read DATABASE_URL from .env
for /f "tokens=1,2 delims==" %%a in ('type .env ^| findstr /v "^#"') do (
    if "%%a"=="DATABASE_URL" set DATABASE_URL=%%b
)

if "%DATABASE_URL%"=="" (
    echo Error: DATABASE_URL not found in .env file
    exit /b 1
)

echo.
echo Running seed.sql against Neon database...
echo Database: %DATABASE_URL%
echo.

REM Run the seed file using psql
psql "%DATABASE_URL%" -f sql\seed.sql

if %errorlevel% equ 0 (
    echo.
    echo ✅ Seed data inserted successfully!
) else (
    echo.
    echo ❌ Error inserting seed data
    exit /b 1
)
