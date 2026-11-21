import { initScene } from './scene.js';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tpl = (id) => $('#' + id).innerHTML;

/* ───────────── 3D stage ───────────── */
const gl = $('#gl');
const stage = initScene(gl, { reduce });
requestAnimationFrame(() => gl.classList.add('on'));

/* ───────────── sound: generated in the browser, nothing downloaded ───────────── */
const Sound = (() => {
  let ctx, master, music, sfx, verb, on = true, started = false, duck = 1, timer;
  const CHORDS = [ // Fmaj9, Am7, Dm9, Bbmaj7(#11)  — warm and unresolved
    [41, 48, 52, 55, 60, 64], [45, 52, 55, 59, 64, 67], [38, 45, 48, 53, 57, 64], [46, 53, 57, 62, 65, 69]
  ];
  const BELL = [72, 74, 76, 79, 81, 84, 86, 88];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
    verb = ctx.createConvolver(); verb.buffer = impulse(5.5, 2.6);
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.55; verb.connect(verbGain); verbGain.connect(master);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master); music.connect(verb);
    sfx = ctx.createGain(); sfx.gain.value = 0.5; sfx.connect(master); sfx.connect(verb);
    air();
  }
  function air() { // soft wind of turning pages
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 300; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    src.connect(bp); bp.connect(g); g.connect(music); src.start();
  }
  function pad(chord, when, dur) {
    chord.forEach((m, i) => {
      [0, 7].forEach((cents, k) => {
        const o = ctx.createOscillator(); o.type = k ? 'triangle' : 'sine'; o.frequency.value = hz(m); o.detune.value = k ? cents + (i % 2 ? 4 : -4) : 0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + i * 90; f.Q.value = 0.3;
        const g = ctx.createGain(); const peak = (i === 0 ? 0.05 : 0.026) * (k ? 0.6 : 1);
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(peak, when + 3.2); g.gain.setValueAtTime(peak, when + dur - 1); g.gain.linearRampToValueAtTime(0, when + dur + 3.5);
        o.connect(f); f.connect(g); g.connect(music); o.start(when); o.stop(when + dur + 4);
      });
    });
  }
  function bell(when) {
    const m = BELL[(Math.random() * BELL.length) | 0];
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'sine'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.76;
    const g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.045, when + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, when + 3.2);
    o.connect(g); g.connect(music); o.start(when); o2.start(when); o.stop(when + 3.3); o2.stop(when + 3.3);
  }
  let ci = 0, next = 0;
  function schedule() { // look-ahead scheduler, endless
    const now = ctx.currentTime;
    while (next < now + 12) {
      pad(CHORDS[ci++ % CHORDS.length], next, 8);
      for (let b = 0; b < 5; b++) if (Math.random() < 0.7) bell(next + 0.6 + b * 1.55 + Math.random() * 0.4);
      next += 8;
    }
  }
  function level() { if (!ctx) return; const v = on ? 0.85 * duck : 0; music.gain.cancelScheduledValues(ctx.currentTime); music.gain.setTargetAtTime(v, ctx.currentTime, 0.8); }
  return {
    start() { init(); ctx.resume(); if (!started) { started = true; next = ctx.currentTime + 0.1; schedule(); timer = setInterval(schedule, 2000); } level(); this.swell(); },
    swell() { if (!ctx) return; const t = ctx.currentTime; [60, 67, 72, 76, 79].forEach((m, i) => bell(t + 0.2 + i * 0.12)); },
    toggle() { on = !on; level(); return on; },
    master(v) { if (!ctx) return; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.25); },
    get on() { return on; },
    duck(d) { duck = d ? 0.45 : 1; level(); },
    blip(kind) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      if (kind === 'hover') { o.frequency.setValueAtTime(1320, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); }
      else { o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.08); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); }
      o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.45);
    },
    suspend() { if (ctx) ctx.suspend(); }, resume() { if (ctx && started) ctx.resume(); }
  };
})();

/* ───────────── the story: each chapter is the .say text of a section ───────────── */
const chapters = $$('[data-ch]').map((sec) => {
  const el = $('.say', sec);
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  const title = (sec.querySelector('.eyebrow') ? sec.querySelector('.eyebrow').lastChild.textContent : sec.id === 'c1' ? 'Welcome' : 'Thank you').trim();
  // wrap words in place so the page itself lights up
  el.textContent = '';
  const words = []; const re = /\S+/g; let m, last = 0;
  while ((m = re.exec(text))) { el.appendChild(document.createTextNode(text.slice(last, m.index))); const s = document.createElement('span'); s.className = 'w'; s.textContent = m[0]; el.appendChild(s); words.push({ el: s, at: m.index }); last = m.index + m[0].length; }
  // sentences
  const sentences = []; const sr = /[^.!?]+[.!?]+["”’]?\s*/g; let sm;
  while ((sm = sr.exec(text))) sentences.push({ text: sm[0].trim(), at: sm.index + (sm[0].length - sm[0].trimStart().length) });
  if (!sentences.length) sentences.push({ text, at: 0 });
  return { sec, el, text, title, words, sentences };
});
const totalWords = chapters.reduce((a, c) => a + c.words.length, 0);

/* ───────────── narrator ───────────── */
const synth = window.speechSynthesis;
const hasTTS = !!(synth && window.SpeechSynthesisUtterance);
const N = {
  ch: 0, si: 0, playing: false, rate: 1, voice: null, follow: true, token: 0, wordTimer: null, gotBoundary: false,
};
const cap = $('#cap'), pChap = $('#pChap'), pProg = $('#pProg'), pPlay = $('#pPlay');
function setPlayIcon(p) { pPlay.innerHTML = p ? tpl('tPause') : tpl('tPlay'); pPlay.setAttribute('aria-label', p ? 'Pause' : 'Play'); }
function wordsDoneBefore(ci) { let n = 0; for (let i = 0; i < ci; i++) n += chapters[i].words.length; return n; }

function markWord(c, charAt) {
  let idx = -1;
  for (let i = 0; i < c.words.length; i++) { if (c.words[i].at <= charAt) idx = i; else break; }
  c.words.forEach((w, i) => { w.el.classList.toggle('c', i === idx); w.el.classList.toggle('r', i < idx); });
  // caption
  const s = c.sentences[N.si];
  if (s) {
    const local = charAt - s.at; const parts = s.text.split(/(\s+)/); let pos = 0, html = '';
    for (const p of parts) {
      const esc = p.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
      if (/^\s+$/.test(p) || !p) html += esc;
      else if (local >= pos && local < pos + p.length + 1) html += '<span class="c">' + esc + '</span>';
      else if (pos < local) html += '<span class="r">' + esc + '</span>';
      else html += esc;
      pos += p.length;
    }
    cap.innerHTML = html;
  }
  const p = (wordsDoneBefore(N.ch) + Math.max(0, idx + 1)) / totalWords;
  pProg.style.width = (p * 100).toFixed(1) + '%';
  if (stage) { stage.progress(Math.max(0, idx) / Math.max(1, c.words.length)); stage.pulse(0.35 + Math.random() * 0.3); }
  if (idx >= 0 && Math.random() < 0.18) Sound.blip('hover');
}
function clearMarks(c) { c.words.forEach((w) => w.el.classList.remove('c', 'r')); }
function finishMarks(c) { c.words.forEach((w) => { w.el.classList.remove('c'); w.el.classList.add('r'); }); }

function chapterLabel() { const c = chapters[N.ch]; pChap.innerHTML = '<b>' + (N.ch + 1) + ' / ' + chapters.length + '</b> · ' + c.title; }

function goTo(sec, smooth) {
  // every chapter is exactly one screen tall, laid out to sit above the player: land on it exactly
  const target = Math.round(scrollY + sec.getBoundingClientRect().top);
  autoScrolling = true; clearTimeout(autoT); autoT = setTimeout(() => (autoScrolling = false), 1600);
  scrollTo({ top: target, behavior: smooth && !reduce ? 'smooth' : 'auto' });
}
let autoScrolling = false, autoT;

function speakSentence() {
  const c = chapters[N.ch], s = c.sentences[N.si];
  if (!s) return nextChapter(true);
  const my = ++N.token;
  const u = new SpeechSynthesisUtterance(s.text);
  u.lang = N.voice ? N.voice.lang : 'en-US'; if (N.voice) { try { u.voice = N.voice; } catch (e) {} }
  u.rate = N.rate; u.pitch = 1;
  N.gotBoundary = false;
  // fallback word timing for voices that don't report word boundaries
  const localWords = []; s.text.replace(/\S+/g, (w, i) => localWords.push(i));
  let wi = 0;
  clearInterval(N.wordTimer);
  u.onstart = () => {
    if (my !== N.token) return;
    markWord(c, s.at);
    const per = 60000 / (175 * N.rate);
    N.wordTimer = setInterval(() => { if (N.gotBoundary || my !== N.token) return clearInterval(N.wordTimer); wi++; if (wi < localWords.length) markWord(c, s.at + localWords[wi]); }, per);
  };
  u.onboundary = (e) => { if (my !== N.token) return; if (e.name && e.name !== 'word') return; N.gotBoundary = true; markWord(c, s.at + e.charIndex); };
  u.onend = () => {
    if (my !== N.token) return; clearInterval(N.wordTimer);
    N.si++;
    if (N.si < c.sentences.length) setTimeout(() => { if (my === N.token && N.playing) speakSentence(); }, 260);
    else { finishMarks(c); setTimeout(() => { if (my === N.token && N.playing) nextChapter(true); }, 900); }
  };
  u.onerror = (e) => { if (my !== N.token) return; clearInterval(N.wordTimer); if (e.error === 'interrupted' || e.error === 'canceled') return; N.si++; if (N.playing) setTimeout(speakSentence, 200); };
  synth.speak(u);
}
function startChapter(i, fromUser) {
  synth.cancel(); N.token++; clearInterval(N.wordTimer);
  chapters.forEach((c, k) => { c.el.classList.toggle('live', k === i); if (k !== i) (k < i ? finishMarks : clearMarks)(c); });
  N.ch = i; N.si = 0; chapterLabel(); clearMarks(chapters[i]);
  if (N.follow || fromUser) { N.follow = true; $('#follow').classList.remove('show'); goTo(chapters[i].sec, true); }
  cap.textContent = chapters[i].sentences[0].text;
  Sound.blip('click');
  if (stage) { stage.pulse(1.2); stage.progress(0); }
  setTimeout(() => { if (N.playing && N.ch === i) speakSentence(); }, fromUser ? 500 : 1100);
}
function nextChapter(auto) {
  if (N.ch < chapters.length - 1) startChapter(N.ch + 1, !auto);
  else { N.playing = false; setPlayIcon(false); document.body.classList.remove('narrating'); Sound.duck(false); if (stage) stage.speaking(false); cap.textContent = 'The end. Thank you for listening.'; pProg.style.width = '100%'; }
}
function play() {
  if (!hasTTS) return;
  N.playing = true; setPlayIcon(true); document.body.classList.add('narrating'); Sound.duck(true); if (stage) stage.speaking(true);
  if (N.ch === chapters.length - 1 && N.si >= chapters[N.ch].sentences.length) return startChapter(0, true);
  chapters[N.ch].el.classList.add('live');
  synth.cancel(); N.token++; setTimeout(speakSentence, 120);
}
function pause() {
  N.playing = false; N.token++; synth.cancel(); clearInterval(N.wordTimer); setPlayIcon(false);
  document.body.classList.remove('narrating'); Sound.duck(false); if (stage) stage.speaking(false);
}

/* ───────────── voices ───────────── */
const ddBtn = $('#ddBtn'), ddList = $('#ddList'), ddName = $('#ddName');
let voices = [], vsel = 0, vact = 0;
const REG = { US: 'United States', GB: 'United Kingdom', IN: 'India', AU: 'Australia', CA: 'Canada', IE: 'Ireland', ZA: 'South Africa', NZ: 'New Zealand' };
const regionOf = (v) => REG[(v.lang.split(/[-_]/)[1] || '').toUpperCase()] || 'Other';
function vparts(v) {
  let n = v.name.replace(/\s*\(.*?\)\s*$/, '').split(/\s+-\s+/)[0], vendor = '';
  const m = n.match(/^(Microsoft|Google|Apple|Samsung)\s+(.*)$/); if (m) { vendor = m[1]; n = m[2]; }
  if (vendor === 'Google') n = 'Google ' + (n.replace(/\s*English\s*/, ' ').replace(/\s+/g, ' ').trim() || 'English');
  return { name: n.trim() || v.name, sub: (vendor ? vendor + ' · ' : '') + regionOf(v) };
}
function pickVoice(i) {
  vsel = i; N.voice = voices[i] || null; ddName.textContent = N.voice ? vparts(N.voice).name : 'Voice';
  $$('.dd-opt', ddList).forEach((o) => o.setAttribute('aria-selected', +o.dataset.i === i ? 'true' : 'false'));
}
function loadVoices() {
  const prev = N.voice && N.voice.name;
  let all = synth.getVoices(); let v = all.filter((x) => /^en/i.test(x.lang)); if (!v.length) v = all; if (!v.length) return;
  const order = ['India', 'United Kingdom', 'United States'];
  voices = v.map((x, i) => ({ x, i })).sort((a, b) => { let ra = order.indexOf(regionOf(a.x)), rb = order.indexOf(regionOf(b.x)); ra = ra < 0 ? 9 : ra; rb = rb < 0 ? 9 : rb; return ra - rb || a.i - b.i; }).map((o) => o.x);
  ddList.innerHTML = ''; let g = '';
  voices.forEach((vo, i) => {
    const r = regionOf(vo); if (r !== g) { g = r; const h = document.createElement('li'); h.className = 'dd-group'; h.setAttribute('role', 'presentation'); h.textContent = r; ddList.appendChild(h); }
    const p = vparts(vo), li = document.createElement('li'); li.className = 'dd-opt'; li.id = 'vo' + i; li.dataset.i = i; li.setAttribute('role', 'option');
    li.innerHTML = '<span class="av' + (/^Google/.test(vo.name) ? ' alt' : '') + '"></span><span class="dd-txt"><b></b><small></small></span><span class="tag"></span>' + tpl('tTick').replace('class="i"', 'class="i tick"');
    li.children[0].textContent = p.name.charAt(0).toUpperCase(); li.querySelector('b').textContent = p.name; li.querySelector('small').textContent = p.sub; li.querySelector('.tag').textContent = vo.lang;
    ddList.appendChild(li);
  });
  // prefer a natural-sounding default: previous > Natural/Neural/Google UK > system default
  let k = voices.findIndex((x) => x.name === prev);
  if (k < 0) k = voices.findIndex((x) => /natural|neural/i.test(x.name));
  if (k < 0) k = voices.findIndex((x) => /Google UK English Female/.test(x.name));
  if (k < 0) k = voices.findIndex((x) => x.default);
  pickVoice(Math.max(0, k));
}
function openDD() { if (!voices.length) return; ddList.hidden = false; ddBtn.setAttribute('aria-expanded', 'true'); vact = vsel; hiDD(true); ddList.focus({ preventScroll: true }); }
function closeDD(f) { ddList.hidden = true; ddBtn.setAttribute('aria-expanded', 'false'); if (f) ddBtn.focus(); }
function hiDD(scroll) { $$('.dd-opt', ddList).forEach((o) => { const on = +o.dataset.i === vact; o.classList.toggle('act', on); if (on) { ddList.setAttribute('aria-activedescendant', o.id); if (scroll) o.scrollIntoView({ block: 'nearest' }); } }); }
function chooseVoice(i) { pickVoice(i); closeDD(true); if (N.playing) { synth.cancel(); N.token++; setTimeout(speakSentence, 150); } }
ddBtn.addEventListener('click', () => (ddList.hidden ? openDD() : closeDD(true)));
ddList.addEventListener('click', (e) => { const o = e.target.closest('.dd-opt'); if (o) chooseVoice(+o.dataset.i); });
ddList.addEventListener('mousemove', (e) => { const o = e.target.closest('.dd-opt'); if (o && +o.dataset.i !== vact) { vact = +o.dataset.i; hiDD(false); } });
ddList.addEventListener('keydown', (e) => {
  const n = voices.length;
  if (e.key === 'ArrowDown') { e.preventDefault(); vact = Math.min(n - 1, vact + 1); hiDD(true); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); vact = Math.max(0, vact - 1); hiDD(true); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseVoice(vact); }
  else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); closeDD(e.key === 'Escape'); }
});
document.addEventListener('click', (e) => { if (!ddList.hidden && !e.target.closest('#dd')) closeDD(false); });
if (hasTTS) { loadVoices(); if ('onvoiceschanged' in synth) synth.onvoiceschanged = loadVoices; }

/* ───────────── player controls ───────────── */
const player = $('#player'), listen = $('#listen');
const RATES = [0.8, 1, 1.25, 1.5, 1.75];
$('#pSpeed').addEventListener('click', (e) => {
  N.rate = RATES[(RATES.indexOf(N.rate) + 1) % RATES.length]; e.currentTarget.textContent = N.rate + '×';
  if (N.playing) { synth.cancel(); N.token++; setTimeout(speakSentence, 120); }
});
pPlay.addEventListener('click', () => (N.playing ? pause() : play()));
$('#pPrev').addEventListener('click', () => { N.playing = true; setPlayIcon(true); document.body.classList.add('narrating'); Sound.duck(true); startChapter(Math.max(0, N.ch - (N.si > 1 ? 0 : 1)), true); });
$('#pNext').addEventListener('click', () => { N.playing = true; setPlayIcon(true); document.body.classList.add('narrating'); Sound.duck(true); if (N.ch < chapters.length - 1) startChapter(N.ch + 1, true); });
$('#pMusic').addEventListener('click', (e) => { const on = Sound.toggle(); e.currentTarget.classList.toggle('off', !on); e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false'); e.currentTarget.setAttribute('aria-label', on ? 'Mute music' : 'Play music'); });
$('#pClose').addEventListener('click', () => { pause(); player.classList.remove('show'); listen.classList.add('show'); $('#follow').classList.remove('show'); });
listen.addEventListener('click', () => {
  Sound.start(); Sound.master(true); syncWaves(true); listen.classList.remove('show'); player.classList.add('show');
  // start from the chapter the reader is looking at
  const i = currentSection(); N.follow = true; N.playing = true; setPlayIcon(true); document.body.classList.add('narrating'); Sound.duck(true); if (stage) stage.speaking(true);
  startChapter(i, true);
});
$('#follow').addEventListener('click', () => { N.follow = true; $('#follow').classList.remove('show'); goTo(chapters[N.ch].sec, true); });
addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select,[contenteditable],.dd-list')) return;
  if (e.code === 'Space' && player.classList.contains('show')) { e.preventDefault(); N.playing ? pause() : play(); }
});

/* if the reader scrolls away on their own, stop dragging them back */
function userScrolled() {
  if (autoScrolling || !N.playing) return;
  const r = chapters[N.ch].sec.getBoundingClientRect();
  if (r.bottom < innerHeight * 0.15 || r.top > innerHeight * 0.85) { N.follow = false; $('#follow').classList.add('show'); }
}
addEventListener('wheel', () => setTimeout(userScrolled, 60), { passive: true });
addEventListener('touchmove', () => setTimeout(userScrolled, 60), { passive: true });
addEventListener('keydown', (e) => { if (/Arrow|Page|Home|End/.test(e.key)) setTimeout(userScrolled, 200); });
function currentSection() {
  let best = 0, bd = Infinity;
  chapters.forEach((c, i) => { const r = c.sec.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bd) { bd = d; best = i; } });
  return best;
}

/* ───────────── gate ───────────── */
const gate = $('#gate');
function enter(withSound) {
  gate.classList.add('gone'); document.body.classList.remove('locked');
  if (stage) stage.open();
  if (withSound) {
    Sound.start();
    setTimeout(() => {
      player.classList.add('show');
      if (hasTTS) { N.playing = true; setPlayIcon(true); document.body.classList.add('narrating'); Sound.duck(true); if (stage) stage.speaking(true); startChapter(0, true); }
      else cap.textContent = 'This browser has no built-in voice. Try Chrome, Edge or Safari.';
    }, reduce ? 200 : 2600);
  } else setTimeout(() => listen.classList.add('show'), 1200);
  setTimeout(() => gate.remove(), 1400);
}
$('#enter').addEventListener('click', () => enter(true));
$('#enter').focus({ preventScroll: true });
if (location.hash && location.hash.length > 1 && document.querySelector(location.hash)) { enter(false); syncWaves(false); }

/* ───────────── master sound: the waves at the top right ───────────── */
const waves = $('#waves'); let soundOn = true, resumeVoice = false;
function setSound(on) {
  soundOn = on; waves.classList.toggle('on', on); waves.setAttribute('aria-pressed', on ? 'true' : 'false'); waves.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
  if (on) {
    Sound.start(); Sound.master(true);
    if (resumeVoice || !player.classList.contains('show')) { resumeVoice = false; listen.classList.remove('show'); player.classList.add('show'); if (hasTTS && !N.playing) play(); }
  } else {
    Sound.master(false); resumeVoice = N.playing; if (N.playing) pause();
  }
}
waves.addEventListener('click', () => setSound(!soundOn));
function syncWaves(on) { soundOn = on; waves.classList.toggle('on', on); waves.setAttribute('aria-pressed', on ? 'true' : 'false'); waves.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); }

/* ───────────── fit visuals inside their screen ───────────── */
function fitAll() {
  $$('.vis').forEach((v) => {
    const f = v.querySelector('.fit'); if (!f) return;
    f.style.transform = 'none';
    const cw = v.clientWidth, ch = v.clientHeight, nw = f.offsetWidth, nh = f.offsetHeight;
    if (!cw || !ch || !nw || !nh) return;
    const s = Math.min(1, cw / nw, ch / nh);
    f.style.transform = s < 1 ? 'scale(' + s.toFixed(3) + ')' : '';
  });
}
fitAll(); addEventListener('resize', () => { fitAll(); if (N.playing && N.follow) goTo(chapters[N.ch].sec, false); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
addEventListener('load', fitAll);

/* ───────────── page chrome ───────────── */
const hdr = $('#hdr'), finaleSec = $('#c7');
function onScroll() {
  hdr.classList.toggle('scrolled', scrollY > 10);
  if (stage) { stage.scroll(scrollY / innerHeight); const r = finaleSec.getBoundingClientRect(); stage.finale(1 - r.top / innerHeight); }
}
onScroll(); addEventListener('scroll', onScroll, { passive: true });
const nav = $('#nav'), menu = $('#menu');
menu.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', o ? 'true' : 'false'); });
nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); if (N.playing) { N.follow = false; $('#follow').classList.add('show'); } } });
if ('IntersectionObserver' in window) {
  const spy = (sel) => { const links = {}; $$(sel).forEach((a) => (links[a.getAttribute('href').slice(1)] = a));
    const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) Object.keys(links).forEach((k) => links[k].classList.toggle('on', k === e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach((k) => { const el = document.getElementById(k); if (el) so.observe(el); }); };
  spy('#nav a'); spy('.docs nav a');
  if (!reduce) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }); $$('.reveal').forEach((el) => io.observe(el)); }
  else $$('.reveal').forEach((el) => el.classList.add('in'));
} else $$('.reveal').forEach((el) => el.classList.add('in'));

/* hover + click sounds */
document.addEventListener('pointerover', (e) => { const t = e.target.closest('a,button,.tool,.pv'); if (t && !t.contains(e.relatedTarget)) Sound.blip('hover'); });
document.addEventListener('click', (e) => { if (e.target.closest('a,button:not(.pb):not(#enter)')) Sound.blip('click'); });

/* copy buttons */
$$('.code').forEach((box) => {
  const b = document.createElement('button'); b.className = 'copy'; b.type = 'button';
  const C = tpl('tCopy') + '<span>Copy</span>', D = tpl('tTick') + '<span>Copied</span>';
  b.innerHTML = C; b.setAttribute('aria-label', 'Copy code');
  b.addEventListener('click', () => {
    const t = $('pre', box).innerText;
    const ok = () => { b.innerHTML = D; b.classList.add('ok'); setTimeout(() => { b.innerHTML = C; b.classList.remove('ok'); }, 1600); };
    const no = () => { const r = document.createRange(); r.selectNodeContents($('pre', box)); const g = getSelection(); g.removeAllRanges(); g.addRange(r); let d = false; try { d = document.execCommand('copy'); } catch (e) {} if (d) { g.removeAllRanges(); ok(); } else { b.querySelector('span').textContent = 'Press Ctrl+C'; setTimeout(() => (b.innerHTML = C), 2500); } };
    try { navigator.clipboard.writeText(t).then(ok, no); } catch (e) { no(); }
  });
  box.appendChild(b);
});

/* stop cleanly when leaving */
document.addEventListener('visibilitychange', () => { if (document.hidden) Sound.suspend(); else Sound.resume(); });
addEventListener('pagehide', () => { if (hasTTS) synth.cancel(); });
