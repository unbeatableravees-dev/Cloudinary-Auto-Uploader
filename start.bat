@echo off
title Cloudinary Video Auto-Uploader
echo ====================================================
echo Starting Cloudinary Video ^& Text Auto-Uploader...
echo ====================================================
start "" http://localhost:3000
node server.js
pause
