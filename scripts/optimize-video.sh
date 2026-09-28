#!/usr/bin/env bash
# Make a video web-ready for the site: small, starts instantly, plays smoothly.
#
#   scripts/optimize-video.sh IN.mp4 OUT.mp4 [POSTER_AT] [CROP]
#
#   POSTER_AT  second to cut the poster still from (default 0). Use the same
#              value as the card's data-start so the still matches playback.
#   CROP       W:H:X:Y box to keep, for 16:9 footage exported into a vertical
#              canvas (black bars above and below). Find it with:
#                ffmpeg -i IN.mp4 -vf fps=4,cropdetect=limit=24:round=2:reset=0 -f null - 2>&1 | grep -o 'crop=.*' | tail -1
#
# Writes OUT.mp4 plus OUT.jpg (the poster), so the card is never black.
#
# Why these settings: the raw exports were 1080p60 at ~12 Mbps with their index
# at the END of the file. The browser couldn't start until it fetched the tail,
# and 12 Mbps is faster than most phone connections, so they stalled. Output is
# capped at 1280px, ~3 Mbps, index at the front (+faststart), and a keyframe
# every 2s so the rail's start-point seeks and loops land instantly.
set -euo pipefail

in=$1; out=$2; poster_at=${3:-0}; crop=${4:-}

vf=""
[ -n "$crop" ] && vf="crop=$crop,"
# Long side capped at 1280, never upscaled, dimensions kept even for H.264.
vf="${vf}scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'"

ffmpeg -v error -y -i "$in" -vf "$vf" \
  -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p \
  -maxrate 3M -bufsize 6M -force_key_frames 'expr:gte(t,n_forced*2)' \
  -c:a aac -b:a 128k -movflags +faststart "$out"

ffmpeg -v error -y -ss "$poster_at" -i "$out" -frames:v 1 -q:v 3 "${out%.*}.jpg"

printf '%s  %s -> %s\n' "$(du -h "$out" | cut -f1)" "$in" "$out"
