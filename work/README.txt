WORK VIDEOS — the "The clips never stop" rail on the homepage
=============================================================

The rail is a plain list in index.html (section id="work"). The page used to
probe work/01.mp4, 02.mp4 … to find clips, but the first empty slot always
produced a 404 in the browser console, so the list is now written out.

ADD A CLIP (two steps)
----------------------
1. Make it web-ready (small, starts instantly, poster included):

       scripts/optimize-video.sh my-export.mp4 work/02.mp4 [POSTER_AT] [CROP]

   That writes work/02.mp4 and work/02.jpg. Letterboxed export (16:9 inside a
   vertical canvas)? Pass the crop box — the script's header explains how.

2. In index.html, copy one of the <button class="clip …"> blocks inside
   id="rail" and change:
     - style="--ar:W/H"   the clip's real width/height (e.g. 720/1280)
     - data-src / data-poster / <source src> / poster   → your files
     - data-title, aria-label, the chip (Podcast / Brand / Ad) and the caption
     - data-audio="0"     only if the clip has NO sound (the player then
                          plays it muted with a "no audio track" note)
   Order in the HTML = order on the page.

Keep each file around 2–3 MB. Never upload raw exports — 1080p60 at 12 Mbps is
what made the site lag before.
