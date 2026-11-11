// Beju Creative flagship v3 — shared behaviour: living background, springy text, reveals, magnetic buttons.
(() => {
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;

  // ---- living background (one fragment shader, drawn small and scaled up so it stays soft and cheap)
  const cv = document.getElementById('bg');
  const gl = cv && cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (gl) {
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision highp float;uniform vec2 r;uniform float t;uniform vec2 m;uniform float s;uniform vec3 g0,g1,g2,g3,g4;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
vec3 ramp(float x){x=clamp(x,0.,1.);
  vec3 c=mix(g0,g1,smoothstep(.02,.26,x));c=mix(c,g2,smoothstep(.20,.50,x));c=mix(c,g3,smoothstep(.44,.76,x));return mix(c,g4,smoothstep(.70,1.,x));}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*r)/r.y; float tt=t*.13; vec2 mm=(m-.5);
  // a dome of light rising from below: wide bands of colour, soft edges, always slowly breathing
  vec2 c=vec2(mm.x*.26+.14*sin(tt*.6),-.76+.05*cos(tt*.5)+mm.y*.06);
  float d=length((p-c)*vec2(.60,1.))/1.62;
  d+=.13*(n(p*1.0+vec2(tt*.5,-tt*.3))-.5)+.05*(n(p*2.1+vec2(-tt*.4,tt*.6))-.5);
  d+=.055*sin(s*9.4+.6)+.018*sin(tt*1.3);
  vec3 col=ramp(d);
  // life: two slow ribbons of light drift across the dark part, like light moving through glass
  float w1=p.y-(.12+.24*p.x+.17*sin(p.x*1.4+tt*1.1)+.08*sin(p.x*.6-tt*.7));
  float w2=p.y-(-.02-.16*p.x+.13*sin(p.x*1.0-tt*.9+2.)+.07*sin(p.x*2.1+tt*.5));
  float veil=smoothstep(.05,.45,d);
  float th1=.012+.030*n(vec2(p.x*.9+tt*.4,3.)), th2=.008+.018*n(vec2(p.x*1.3-tt*.3,9.));
  col+=g1*.24*exp(-w1*w1/th1)*veil;
  col+=(g1*.12+g0*.07)*exp(-w2*w2/th2)*veil;
  // depth: a second, soft key light high on the right (it lights the orb in the hero), and darker corners
  float key=exp(-pow(length((p-vec2(.52+mm.x*.1,.20+mm.y*.08))*vec2(1.,1.25))/.42,2.)*1.4);
  col+=(g1*.45+vec3(.06))*key*(1.-smoothstep(.0,.10,s))*.55;
  col*=1.-.42*smoothstep(.55,1.45,length(p*vec2(.72,1.)));
  col+=(h(gl_FragCoord.xy+fract(t))-.5)*.02;
  gl_FragColor=vec4(col,1.);}`;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = n => gl.getUniformLocation(pr, n), ur = U('r'), ut = U('t'), um = U('m'), us = U('s');
      // palettes: 2 (olive + wine) is the site's background; 1 and 3 are kept as alternates
      const PAL = {
        1: { g0: [.90, .50, .25], g1: [.360, .380, .130], g2: [.135, .165, .060], g3: [.048, .058, .028], g4: [.016, .018, .012] },   // olive + copper: a warm copper light under clean olive
        2: { g0: [.74, .26, .31], g1: [.370, .360, .140], g2: [.140, .165, .065], g3: [.050, .056, .030], g4: [.017, .017, .013] },   // olive + wine: a deep rose-wine light under olive
        3: { g0: [.95, .50, .28], g1: [.520, .420, .130], g2: [.215, .260, .095], g3: [.075, .055, .135], g4: [.020, .018, .032] },   // olive + copper + indigo: copper core, olive body, indigo night above
      };
      window.setBg = k => { const p = PAL[k] || PAL[2]; for (const n in p) gl.uniform3fv(U(n), p[n]); document.documentElement.dataset.bg = k; };
      window.setBg(2);
      let mx = .5, my = .5, tx = .5, ty = .5;
      const size = () => { const k = .4; cv.width = Math.max(2, innerWidth * k | 0); cv.height = Math.max(2, innerHeight * k | 0); gl.viewport(0, 0, cv.width, cv.height); };
      size(); addEventListener('resize', size);
      addEventListener('pointermove', e => { tx = e.clientX / innerWidth; ty = 1 - e.clientY / innerHeight; }, { passive: true });
      const t0 = performance.now();
      const slow = matchMedia('(pointer:coarse)').matches; let last = 0;
      const draw = now => {
        if (slow && now - last < 42) { requestAnimationFrame(draw); return; } last = now;
        mx += (tx - mx) * .04; my += (ty - my) * .04;
        gl.uniform2f(ur, cv.width, cv.height); gl.uniform1f(ut, (now - t0) / 1000 + 20); gl.uniform2f(um, mx, my);
        gl.uniform1f(us, scrollY / Math.max(1, document.documentElement.scrollHeight));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!calm) requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }
  }

  // ---- springy headlines: wrap each word so it can rise from behind a mask
  document.querySelectorAll('.split').forEach(el => {
    let k = 0;
    const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.style.setProperty('--k', k++); s.textContent = part;
          w.append(s); frag.append(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && !c.classList.contains('w')) walk(c);
    });
    walk(el);
  });

  // ---- reveal on scroll
  // elements animate in every time they come back on screen, so the page stays alive in both directions
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio >= .16) e.target.classList.add('in'); else if (!e.isIntersecting) e.target.classList.remove('in'); }), { threshold: [0, .16], rootMargin: '0px 0px -4% 0px' });
  document.querySelectorAll('.rv,.split').forEach(el => io.observe(el));

  // ---- magnetic buttons and card spotlight
  if (fine && !calm) document.querySelectorAll('[data-magnet]').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .22) + 'px'); b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .32) + 'px'); });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });
  document.querySelectorAll('.card').forEach(c => c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--sx', (e.clientX - r.left) + 'px'); c.style.setProperty('--sy', (e.clientY - r.top) + 'px'); }));

  // ---- a soft light that follows the cursor
  if (fine && !calm) {
    const g = document.createElement('div'); g.className = 'cursor-light'; document.body.append(g);
    let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
    (function f() { gx += (x - gx) * .08; gy += (y - gy) * .08; g.style.transform = `translate3d(${gx - 260}px,${gy - 260}px,0)`; requestAnimationFrame(f); })();
  }

  // ---- numbers that count up when seen
  const co = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; co.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, t0 = performance.now(), d = 1600;
    const step = now => { const x = Math.min(1, (now - t0) / d), y = 1 - Math.pow(1 - x, 4); el.textContent = Math.round(to * y); if (x < 1) requestAnimationFrame(step); };
    calm ? el.textContent = to : requestAnimationFrame(step);
  }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(el => co.observe(el));
})();
