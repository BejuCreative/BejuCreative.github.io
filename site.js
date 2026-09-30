/* BEJÚ Creative — shared behaviour for every page. Documented in /DESIGN.md (Motion).
   Rules: animate transform/opacity only; nothing already on screen at load animates;
   everything is instant under prefers-reduced-motion; the page is fully usable if
   this file (or GSAP) never loads. */
(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  /* ── Nav: strong glass after 40 px, hides on scroll down, returns on scroll up ── */
  var nav = $('.nav'), burger = $('.burger'), sheet = $('.sheet');
  var menuOpen = false, lastY = w.scrollY, ticking = false;
  function onScroll() {
    var y = w.scrollY;
    if (nav) {
      nav.classList.toggle('is-strong', y > 40);
      var down = y > lastY + 4, up = y < lastY - 4;
      if (!menuOpen && !nav.contains(d.activeElement)) {
        if (down && y > 160) nav.classList.add('is-hidden');
        else if (up || y < 160) nav.classList.remove('is-hidden');
      }
    }
    if (parallax) parallax();
    if (cinemaMotion) cinemaMotion();
    lastY = y; ticking = false;
  }
  w.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ── Mobile menu: glass sheet, focus trap, Esc to close ── */
  function setMenu(open) {
    if (!sheet || !burger) return;
    menuOpen = open;
    sheet.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    d.body.classList.toggle('menu-open', open);
    if (open) { nav && nav.classList.remove('is-hidden'); var first = $('a', sheet); first && first.focus(); }
    else burger.focus({ preventScroll: true });
  }
  if (burger && sheet) {
    burger.addEventListener('click', function () { setMenu(!menuOpen); });
    d.addEventListener('keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return; }
      if (e.key !== 'Tab') return;
      // move focus ourselves on every Tab: Safari doesn't Tab to links by default,
      // so leaving it to the browser let focus slip out of the menu
      e.preventDefault();
      var f = [burger].concat($$('a,button', sheet)), i = f.indexOf(d.activeElement);
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    });
  }

  /* ── In-page links: GSAP ScrollToPlugin drives the scroll. CSS scroll-behavior:smooth
       is banned here: it fought ScrollTrigger refreshes and nav links stalled. ── */
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    var id = a.getAttribute('href'); if (id.length < 2) return;
    var t = d.getElementById(id.slice(1)); if (!t) return;
    e.preventDefault();
    if (a.hasAttribute('data-need')) setNeed(a.getAttribute('data-need'));
    if (menuOpen) { menuOpen = false; sheet.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); d.body.classList.remove('menu-open'); }
    // layout position, not getBoundingClientRect: a section still waiting to reveal is
    // translated 16 px, and measuring that made the scroll land 16 px short
    var y = 0; for (var el = t; el; el = el.offsetParent) y += el.offsetTop;
    y = Math.max(0, y - (t.tagName === 'SECTION' ? 0 : 96));
    if (!reduce && w.gsap && w.ScrollToPlugin) {
      gsap.registerPlugin(ScrollToPlugin);
      gsap.to(w, { duration: 0.9, ease: 'power3.inOut', scrollTo: { y: y, autoKill: false } });
    } else {
      w.scrollTo(0, y);
    }
    history.pushState(null, '', id);
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });

  /* ── Reveals: only elements that start below the fold, once, 16 px, staggered ── */
  var io = 'IntersectionObserver' in w;
  var pending = [], counts = [];
  if (!reduce && io) {
    var vh = w.innerHeight;
    var reveal = function (el) {
      rvObs.unobserve(el); pending.splice(pending.indexOf(el), 1);
      el.classList.remove('rv-wait'); el.classList.add('rv-in');
      if (el.hasAttribute('data-lr')) revealLines(el);
    };
    // The observer only sees what is on screen at a frame. A fast scroll during a long
    // frame (a clip starting to decode) can carry elements past unseen, and they'd stay
    // invisible. So whenever anything enters, reveal every pending element above the line.
    var rvObs = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      var line = w.innerHeight * 0.92;
      pending.slice().forEach(function (el) { if (el.getBoundingClientRect().top < line) reveal(el); });
      settleCounts();
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(function (el) {
      if (el.getBoundingClientRect().top < vh * 0.96) return;   // on screen at load: leave it alone
      var sib = el.parentElement ? $$(':scope > .rv', el.parentElement) : [el];
      var i = Math.max(0, sib.indexOf(el));
      el.style.setProperty('--rv-delay', Math.min(i, 6) * 55 + 'ms');
      if (el.hasAttribute('data-lr')) splitLines(el); else el.classList.add('rv-wait');
      pending.push(el); rvObs.observe(el);
    });
  }

  /* Headline line reveal. Text stays accessible (aria-label on the heading, split
     copy aria-hidden) and the original markup is restored once the lines land. */
  function splitLines(h) {
    if ($$('*', h).some(function (n) { return n.tagName !== 'BR'; })) { h.classList.add('rv-wait'); return; }
    var html = h.innerHTML, accessibleCopy = h.cloneNode(true);
    $$('br', accessibleCopy).forEach(function (br) { br.replaceWith(d.createTextNode(' ')); });
    var text = accessibleCopy.textContent.replace(/\s+/g, ' ').trim();
    var parts = html.split(/<br\s*\/?>/i), words = [];
    h.innerHTML = parts.map(function (p, pi) {
      return p.trim().split(/\s+/).filter(Boolean).map(function (wd) { return '<span class="lr-w">' + wd + '</span>'; }).join(' ') + (pi < parts.length - 1 ? '<br>' : '');
    }).join('');
    var lines = [], hb = h.getBoundingClientRect();
    $$('.lr-w', h).forEach(function (s) {
      var top = Math.round(s.getBoundingClientRect().top), L = lines[lines.length - 1];
      if (!L || Math.abs(L.top - top) > 4) lines.push(L = { top: top, words: [] });
      L.words.push(s.textContent);
    });
    var grad = h.classList.contains('grad'), H = hb.height;
    h.setAttribute('aria-label', text); h.dataset.orig = html;
    h.innerHTML = '<span aria-hidden="true">' + lines.map(function (L, i) {
      var g = grad ? ' style="background-size:100% ' + H + 'px;background-position:0 ' + (hb.top - L.top) + 'px"' : '';
      return '<span class="lr-line"><span class="lr-inner' + (grad ? ' grad' : '') + '" style="--i:' + i + '"' + g + '>' + L.words.join(' ') + '</span></span>';
    }).join('') + '</span>';
    if (grad) h.classList.add('lr-flat');
  }
  function revealLines(h) {
    if (!h.dataset.orig) return;
    requestAnimationFrame(function () {
      h.classList.add('lr-in');
      var n = $$('.lr-line', h).length;
      setTimeout(function () {  // restore real markup so resizing reflows normally
        h.innerHTML = h.dataset.orig; delete h.dataset.orig; h.removeAttribute('aria-label');
        h.classList.remove('lr-in', 'lr-flat');
      }, 800 + n * 60 + 80);
    });
  }

  /* ── FAQ: height-animated <details>, icon rotates via CSS ── */
  $$('.acc details').forEach(function (det) {
    var sum = $('summary', det), ans = $('.ans', det);
    if (!sum || !ans || reduce || !ans.animate) return;
    sum.addEventListener('click', function (e) {
      e.preventDefault();
      if (det.dataset.busy) return; det.dataset.busy = '1';
      if (!det.open) {
        det.open = true;
        var h = ans.scrollHeight;
        ans.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' })
          .onfinish = function () { delete det.dataset.busy; };
      } else {
        det.classList.add('closing');
        ans.animate([{ height: ans.scrollHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.65,0,.35,1)' })
          .onfinish = function () { det.open = false; det.classList.remove('closing'); delete det.dataset.busy; };
      }
    });
  });

  /* ── Videos: autoplay muted only while in view; pause off-screen ── */
  function seekStart(v) {
    var s = parseFloat(v.getAttribute('data-start') || '0');
    if (!s || v.dataset.seeked) return;
    var go = function () { if (v.dataset.seeked) return; try { if (v.currentTime < s - 0.3) v.currentTime = s; if (v.currentTime >= s - 0.3) v.dataset.seeked = '1'; } catch (e) {} };
    if (v.readyState >= 1) go();
    v.addEventListener('loadedmetadata', go); v.addEventListener('playing', go);
  }
  var previewsPaused = reduce, visibleClips = new Set(), clipsReady = false;
  try { previewsPaused = reduce || sessionStorage.getItem('beju-previews-paused') === 'true'; } catch (e) {}
  function syncClip(v) {
    if (!clipsReady || previewsPaused || d.hidden || (lb && lb.open) || !visibleClips.has(v) || v.closest('[hidden]')) { v.pause(); return; }
    v.preload = 'auto'; seekStart(v); var play = v.play(); play && play.catch(function () {});
  }
  function syncPreviews() {
    $$('video[data-inview]').forEach(syncClip);
    $$('[data-preview-toggle]').forEach(function (b) {
      b.hidden = false; b.setAttribute('aria-pressed', String(previewsPaused));
      b.textContent = previewsPaused ? 'Play previews' : 'Pause previews';
    });
  }
  // Article pages get a local control next to their media, using the same preference.
  if (!$$('[data-preview-toggle]').length && $('video[data-inview]')) {
    var media = $('.svc-media, .launch-meta');
    if (media) { var control = d.createElement('button'); control.type = 'button'; control.className = 'preview-toggle'; control.setAttribute('data-preview-toggle', ''); media.after(control); }
  }
  $$('[data-preview-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      previewsPaused = !previewsPaused;
      try { sessionStorage.setItem('beju-previews-paused', String(previewsPaused)); } catch (e) {}
      syncPreviews();
    });
  });
  syncPreviews();
  d.addEventListener('visibilitychange', syncPreviews);

  // Starts only after the page has loaded and painted, so no clip download competes with
  // the first screen. Under reduced motion nothing autoplays: the stills stay.
  function startClips() {
    if (!io) return;
    clipsReady = true;
    var vObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && e.intersectionRatio >= 0.5) visibleClips.add(v);
        else visibleClips.delete(v);
        syncClip(v);
      });
    }, { threshold: 0.5 });
    $$('video[data-inview]').forEach(function (v) {
      v.addEventListener('timeupdate', function () { if (v.currentTime < 0.3 && v.dataset.seeked) { delete v.dataset.seeked; seekStart(v); } });
      v.addEventListener('playing', function () { v.classList.add('is-playing'); });
      vObs.observe(v);
    });
  }
  // Non-critical work waits for both the first contentful paint and the load event
  // (on a fast connection load can fire before anything is painted).
  var settledQ = [], painted = false, loaded = d.readyState === 'complete';
  function settle() { if (!painted || !loaded) return; while (settledQ.length) setTimeout(settledQ.shift(), 0); }
  function whenSettled(fn) { settledQ.push(fn); settle(); }
  var PO = w.PerformanceObserver;
  if (PO && PO.supportedEntryTypes && PO.supportedEntryTypes.indexOf('paint') > -1) {
    new PO(function (l) { if (l.getEntriesByName('first-contentful-paint').length) { painted = true; settle(); } }).observe({ type: 'paint', buffered: true });
  } else painted = true;
  if (!loaded) w.addEventListener('load', function () { loaded = true; settle(); });
  setTimeout(function () { painted = loaded = true; settle(); }, 8000);   // never wait forever
  whenSettled(startClips);

  /* ── Lightbox: native <dialog> (focus trap + Esc), ←/→ and swipe ── */
  var lb, lbVideo, lbCap, lbItems = [], lbIndex = 0, opener = null;
  function buildLb() {
    lb = d.createElement('dialog'); lb.className = 'lb'; lb.setAttribute('aria-label', 'Video player');
    var ico = function (p) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + p + '"/></svg>'; };
    lb.innerHTML = '<div class="lb-stage"><video playsinline controls preload="auto"></video></div>' +
      '<div class="lb-bar"><p class="lb-cap" aria-live="polite"></p><div class="lb-nav">' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Previous video">' + ico('M15 18l-6-6 6-6') + '</button>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Next video">' + ico('M9 18l6-6-6-6') + '</button></div></div>' +
      '<button class="lb-btn lb-close" type="button" aria-label="Close player">' + ico('M18 6L6 18M6 6l12 12') + '</button>';
    d.body.appendChild(lb);
    lbVideo = $('video', lb); lbCap = $('.lb-cap', lb);
    $('.lb-close', lb).addEventListener('click', closeLb);
    $('.lb-prev', lb).addEventListener('click', function () { stepLb(-1); });
    $('.lb-next', lb).addEventListener('click', function () { stepLb(1); });
    lb.addEventListener('close', function () { lbVideo.pause(); lbVideo.removeAttribute('src'); lbVideo.load(); opener && opener.focus({ preventScroll: true }); syncPreviews(); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-stage')) closeLb(); });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') stepLb(-1); if (e.key === 'ArrowRight') stepLb(1); });
    var sx = null;
    $('.lb-stage', lb).addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sx = e.clientX; });
    $('.lb-stage', lb).addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1); });
  }
  function showLb() {
    var it = lbItems[lbIndex];
    lbVideo.src = it.getAttribute('data-src');
    lbVideo.poster = it.getAttribute('data-poster') || '';
    lbVideo.muted = false;
    lbVideo.setAttribute('aria-label', it.getAttribute('data-title') || 'Video');
    lbCap.innerHTML = '<b></b> <span></span>';
    lbCap.firstChild.textContent = it.getAttribute('data-title') || '';
    lbCap.lastChild.textContent = lbItems.length > 1 ? '· ' + (lbIndex + 1) + ' / ' + lbItems.length : '';
    lb.setAttribute('data-count', String(lbItems.length));
    var p = lbVideo.play(); p && p.catch(function () {});
  }
  function stepLb(n) { if (lbItems.length < 2) return; lbIndex = (lbIndex + n + lbItems.length) % lbItems.length; showLb(); }
  function closeLb() { lb && lb.open && lb.close(); }
  $$('[data-lb]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (el.dataset.dragged) { e.preventDefault(); return; }
      if (!lb) buildLb();
      opener = el;
      var g = el.getAttribute('data-lb');
      lbItems = $$('[data-lb="' + g + '"]').filter(function (it) { return !it.hidden; }); lbIndex = lbItems.indexOf(el);
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      $$('video[data-inview]').forEach(function (v) { v.pause(); });
      showLb();
    });
  });

  /* ── Rail: native scroll + snap for touch/trackpad; mouse drag with momentum ── */
  $$('[data-rail]').forEach(function (rail) {
    var prev = $('[data-rail-prev="' + rail.id + '"]'), next = $('[data-rail-next="' + rail.id + '"]');
    var step = function () { var c = Array.prototype.find.call(rail.children, function (el) { return !el.hidden; }); return c ? c.getBoundingClientRect().width + 16 : 320; };
    prev && prev.addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    next && next.addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });
    var sync = function () {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      if (prev) prev.disabled = rail.scrollLeft <= 2; if (next) next.disabled = rail.scrollLeft >= max;
      var progress = $('[data-rail-progress="' + rail.id + '"]');
      if (progress) progress.style.setProperty('--rail-progress', max <= 0 ? 1 : Math.min(1, (rail.scrollLeft + rail.clientWidth) / rail.scrollWidth));
    };
    rail.addEventListener('scroll', sync, { passive: true }); rail.addEventListener('gallerychange', sync); w.addEventListener('resize', sync); sync();
    if (!finePointer) return;
    var down = false, x0 = 0, s0 = 0, lastX = 0, lastT = 0, vel = 0, moved = 0, raf = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = 0; x0 = lastX = e.clientX; s0 = rail.scrollLeft; lastT = performance.now(); vel = 0;
      cancelAnimationFrame(raf); rail.classList.add('is-dragging');
    });
    w.addEventListener('pointermove', function (e) {
      if (!down) return;
      var now = performance.now(), dx = e.clientX - x0; moved = Math.max(moved, Math.abs(dx));
      rail.scrollLeft = s0 - dx; vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
    });
    w.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      $$('[data-lb]', rail).forEach(function (c) { if (moved > 6) { c.dataset.dragged = '1'; setTimeout(function () { delete c.dataset.dragged; }, 50); } });
      var v = -vel * 16;   // px per frame
      (function glide() {
        if (Math.abs(v) < 0.4 || reduce) { rail.classList.remove('is-dragging'); return; }
        rail.scrollLeft += v; v *= 0.93; raf = requestAnimationFrame(glide);
      })();
    });
  });

  /* Selected-work filters keep the original film order and lightbox navigation. */
  var workRail = $('#rail'), galleryTools = $('[data-gallery-tools]');
  if (workRail && galleryTools) {
    galleryTools.hidden = false;
    var films = $$('.clip', workRail), filters = $$('[data-filter]', galleryTools);
    filters.forEach(function (button) {
      button.addEventListener('click', function () {
        var category = button.dataset.filter, shown = 0;
        filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        films.forEach(function (film) {
          var chip = $('.chip', film), matches = category === 'all' || (chip && chip.textContent.trim().toLowerCase() === category);
          film.hidden = !matches;
          if (matches) {
            shown++;
            if (!reduce && film.animate) film.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: (shown - 1) * 35, easing: 'cubic-bezier(.16,1,.3,1)' });
          } else { var v = $('video', film); if (v) { visibleClips.delete(v); v.pause(); } }
        });
        workRail.scrollLeft = 0; workRail.dispatchEvent(new Event('gallerychange'));
        var status = $('[data-gallery-status]'); if (status) status.textContent = shown + ' selected film' + (shown === 1 ? '' : 's') + ' · Drag to explore';
      });
    });
  }

  /* One glass highlight travels between links; transform-only, no moving hit targets. */
  var navLinks = $('.nav-links'), navMarker, markerLink = null, markerMotion = null;
  function moveNavMarker(link) {
    if (!navMarker) return;
    var previous = navMarker.getBoundingClientRect();
    if (markerMotion) markerMotion.cancel();
    if (!link || !link.offsetWidth) { navMarker.style.opacity = '0'; markerLink = null; return; }
    var x = link.offsetLeft, width = link.offsetWidth, hadLink = !!markerLink;
    navMarker.style.width = width + 'px'; navMarker.style.transform = 'translateX(' + x + 'px)'; navMarker.style.opacity = '1';
    if (hadLink && !reduce && navMarker.animate) {
      var left = navLinks.getBoundingClientRect().left;
      markerMotion = navMarker.animate([
        { transform: 'translateX(' + (previous.left - left) + 'px) scaleX(' + previous.width / width + ')' },
        { transform: 'translateX(' + x + 'px) scaleX(1)' }
      ], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    markerLink = link;
  }
  function restoreNavMarker() { moveNavMarker($('a[aria-current="location"]', navLinks)); }
  if (navLinks) {
    navMarker = d.createElement('span'); navMarker.className = 'nav-marker'; navMarker.setAttribute('aria-hidden', 'true');
    navLinks.appendChild(navMarker); navLinks.classList.add('has-marker');
    $$('a', navLinks).forEach(function (a) {
      a.addEventListener('pointerenter', function () { moveNavMarker(a); });
      a.addEventListener('focus', function () { moveNavMarker(a); });
    });
    navLinks.addEventListener('pointerleave', restoreNavMarker);
    navLinks.addEventListener('focusout', function (e) { if (!navLinks.contains(e.relatedTarget)) restoreNavMarker(); });
    w.addEventListener('resize', restoreNavMarker, { passive: true });
  }

  /* The nav highlights the chapter currently being read. */
  if (io && nav) {
    var chapterLinks = $$('.nav-links a[href^="#"]'), chapters = chapterLinks.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
    var chapterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        chapterLinks.forEach(function (a) { if (a.hash === '#' + entry.target.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
        restoreNavMarker();
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    chapters.forEach(function (section) { chapterObs.observe(section); });
  }

  /* ── Primary CTA: subtle magnetic pull, desktop only, ≤ 6 px, no bounce ── */
  if (finePointer && !reduce) {
    $$('.magnetic').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = Math.max(-6, Math.min(6, (e.clientX - r.left - r.width / 2) * 0.12));
        var y = Math.max(-6, Math.min(6, (e.clientY - r.top - r.height / 2) * 0.2));
        b.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  }

  /* ── Count-up once in view (HTML already holds the final value) ── */
  var finalText = function (el) { return el.getAttribute('data-count') + (el.getAttribute('data-suffix') || ''); };
  // a count that was scrolled past unseen just shows its final value
  function settleCounts() {
    counts.slice().forEach(function (el) {
      if (el.getBoundingClientRect().bottom >= 0) return;
      cObs.unobserve(el); counts.splice(counts.indexOf(el), 1); el.textContent = finalText(el);
    });
  }
  if (!reduce && io) {
    var cObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; cObs.unobserve(e.target); counts.splice(counts.indexOf(e.target), 1);
        var el = e.target, to = parseFloat(el.getAttribute('data-count')), sfx = el.getAttribute('data-suffix') || '', t0 = performance.now();
        (function tick(t) {
          var p = Math.min(1, (t - t0) / 1400), ease = 1 - Math.pow(2, -10 * p);   // expo.out
          el.textContent = Math.round(to * (p === 1 ? 1 : ease)) + sfx;
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) {
      if (el.getBoundingClientRect().top < w.innerHeight) return;
      el.textContent = '0' + (el.getAttribute('data-suffix') || ''); counts.push(el); cObs.observe(el);
    });
  }

  /* ── Hero: video frame drifts and scales ≤ 1.05 as the hero scrolls out ── */
  var heroMedia = $('[data-parallax]'), parallax = null;
  if (heroMedia && !reduce && finePointer) {
    var hero = heroMedia.closest('section');
    parallax = function () {
      if (w.innerWidth <= 900) { heroMedia.style.removeProperty('--hero-drift'); heroMedia.style.removeProperty('--hero-scale'); return; }
      var h = hero.offsetHeight, y = w.scrollY; if (y > h) return;
      var p = Math.max(0, Math.min(1, y / h));
      heroMedia.style.setProperty('--hero-drift', (p * -32).toFixed(1) + 'px');
      heroMedia.style.setProperty('--hero-scale', (1 + p * 0.035).toFixed(4));
    };
    var stage = heroMedia.closest('.hero-media');
    stage.addEventListener('pointermove', function (e) {
      if (w.innerWidth <= 900) return;
      var r = stage.getBoundingClientRect();
      heroMedia.style.setProperty('--tilt-x', ((0.5 - (e.clientY - r.top) / r.height) * 5).toFixed(2) + 'deg');
      heroMedia.style.setProperty('--tilt-y', (((e.clientX - r.left) / r.width - 0.5) * 7).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', function () { heroMedia.style.removeProperty('--tilt-x'); heroMedia.style.removeProperty('--tilt-y'); });
  }
  var cinemaMotion = null, cinema = $('[data-cinema]');
  if (cinema && !reduce && finePointer) {
    cinemaMotion = function () {
      if (w.innerWidth <= 900) { cinema.style.removeProperty('--cinema-scale'); return; }
      var r = cinema.getBoundingClientRect(); if (r.bottom < 0 || r.top > w.innerHeight) return;
      var p = Math.max(0, Math.min(1, (w.innerHeight - r.top) / (w.innerHeight * .75)));
      cinema.style.setProperty('--cinema-scale', (.94 + .06 * p).toFixed(4));
    };
  }
  w.addEventListener('resize', onScroll, { passive: true });

  /* ── Pricing toggle: crossfade, no layout shift (panels share one grid cell) ── */
  $$('[data-toggle]').forEach(function (grp) {
    var tabs = $$('[role="tab"]', grp), panels = $$('[data-panel]', d.getElementById(grp.getAttribute('data-toggle')));
    var pick = function (i, focus) {
      grp.style.setProperty('--selected-tab', i);
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      panels.forEach(function (p, j) { var on = i === j; p.classList.toggle('is-on', on); p.setAttribute('aria-hidden', String(!on)); if (on) p.removeAttribute('inert'); else p.setAttribute('inert', ''); });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(i); });
      t.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick((i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true); } });
    });
  });

  /* ── Start-a-project form → Google Form (no backend on GitHub Pages) ── */
  var form = $('#start-form');
  function setNeed(v) { var s = form && form.elements.namedItem('need'); if (s) s.value = v; }
  if (form) {
    var status = $('.form-status', form), btn = $('button[type="submit"]', form);
    var fields = ['name', 'email', 'need'];
    var check = function (name) {
      var el = form.elements.namedItem(name), f = el.closest('.field'), msg = '';
      if (!el.value.trim()) msg = 'Please fill this in.';
      else if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim())) msg = 'That email doesn’t look right.';
      f.classList.toggle('is-invalid', !!msg); el.setAttribute('aria-invalid', String(!!msg));
      $('.err', f).textContent = msg; return !msg;
    };
    fields.forEach(function (n) { form.elements.namedItem(n).addEventListener('blur', function () { if (this.value) check(n); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = fields.map(check).every(Boolean);
      if (!ok) { var bad = $('.is-invalid input, .is-invalid select', form); bad && bad.focus(); return; }
      var data = new URLSearchParams(), map = JSON.parse(form.getAttribute('data-entries'));
      Object.keys(map).forEach(function (k) { data.append(map[k], (form.elements.namedItem(k).value || '').trim()); });
      btn.setAttribute('aria-busy', 'true'); btn.disabled = true; status.hidden = true;
      fetch(form.getAttribute('data-action'), { method: 'POST', mode: 'no-cors', body: data })
        .then(function () {
          status.className = 'form-status ok'; status.hidden = false;
          status.textContent = 'Got it — we’ll reply within 24 hours (check spam if you don’t see us).';
          form.reset();
        })
        .catch(function () {   // keep everything they typed; offer e-mail as a fallback
          var v = function (k) { return (form.elements.namedItem(k).value || '').trim(); };
          var body = 'Name: ' + v('name') + '\nNeed: ' + v('need') + '\nLink: ' + v('link') + '\n\n' + v('message');
          status.className = 'form-status bad'; status.hidden = false;
          status.innerHTML = 'That didn’t send — your connection may have dropped. Your answers are still here. <a class="link" href="mailto:bejusipe@gmail.com?subject=' +
            encodeURIComponent('New project — ' + v('need')) + '&body=' + encodeURIComponent(body) + '">Send it by email instead</a>.';
        })
        .then(function () { btn.removeAttribute('aria-busy'); btn.disabled = false; status.focus && status.focus(); });
    });
  }
  $$('a[data-need]').forEach(function (a) { a.addEventListener('click', function () { setNeed(a.getAttribute('data-need')); }); });

  /* GSAP only drives anchor scrolling, so it loads after the page has: until it arrives
     (or if it never does) anchors jump instantly. */
  function loadGsap() {
    if (reduce || w.gsap) return;
    var add = function (src, next) { var sc = d.createElement('script'); sc.src = src; sc.onload = next; d.head.appendChild(sc); };
    add('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js', function () {
      add('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollToPlugin.min.js');
    });
  }
  whenSettled(loadGsap);

  onScroll();
})();
