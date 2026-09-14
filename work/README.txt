WORK VIDEOS — the "THE CLIPS NEVER STOP" rail
=============================================

DROP YOUR VIDEOS IN HERE, NAMED EXACTLY:

    01.mp4
    02.mp4
    03.mp4
    04.mp4
    05.mp4
    06.mp4
    07.mp4
    08.mp4
    09.mp4
    10.mp4
    11.mp4
    12.mp4

Start at 01 and count up. You don't need all twelve — any slot with
no file in it is removed from the page automatically. Put in 3, you
get 3 cards. Put in 12, you get 12.

Order on the page = the order of the numbers. 01 shows first.


LABELS
------
To title a card, drop a matching .txt file next to the video:

    01.mp4
    01.txt      <- one line, e.g:   Podcast Clip — Trakyo

If there's no .txt, the card just shows no label. Fine either way.


CATEGORY TAG (the small gold badge)
-----------------------------------
Second line of the same .txt file, if you want one:

    01.txt:
        Podcast Clip — Trakyo
        Podcast

Line 1 = title. Line 2 = the gold badge. Leave line 2 out for no badge.


WHAT WORKS BEST
---------------
  - VERTICAL 1080x1920 full frame is ideal — it gets a tall card.

  - TRUE 16:9 (1920x1080) is FINE, it gets a wide card instead.
    The page handles both.

  - !! 16:9 EXPORTED INTO A 1080x1920 CANVAS IS THE ONE TO AVOID !!
    The page reads the file's dimensions to decide the card shape.
    A letterboxed file REPORTS 1080x1920, so it gets a tall card,
    and you'll see big black bars above and below your footage.

    There is no way for the page to detect this by itself — the
    black bars are part of the picture, not the file size.

    5 of your 8 current portfolio files have this problem
    (Podcast Edit 1, both Personal Brand Edits, Personal Brand 1,
    Personal Brand 2). Re-export those filling the frame, OR just
    tell me and I'll measure each one and set its card shape by
    hand like I did for the current eight.

  - 10-30 seconds each. They autoplay muted on scroll and loop.

  - Keep each file under ~15MB if you can. Eight 60MB files makes
    the page slow to load. Your current "PODCAST EDIT 1" is 62MB —
    that one's worth compressing.


COMPRESSING (if a file is too big)
----------------------------------
Ask me and I'll do it, or run:

    ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset slow \
      -movflags +faststart -c:a aac -b:a 128k output.mp4


POSTERS
-------
Don't worry about these. I generate a still from each video
automatically so the cards aren't black before they load.
Just tell me when you've added the videos and I'll cut them.
