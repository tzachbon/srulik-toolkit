#!/usr/bin/env bash
# Renders out/video.mp4 with its music, out/poster.png and out/contact-sheet.png from the scenes
# and any existing capture. Capture is a separate step: node record-example.mjs
set -euo pipefail
cd "$(dirname "$0")"
node render.mjs
node music.mjs "$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/video.mp4)"
ffmpeg -v error -y -i out/video.mp4 -i out/music.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/with-music.mp4
mv out/with-music.mp4 out/video.mp4
node contact-sheet.mjs
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of compact out/video.mp4
