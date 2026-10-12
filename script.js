import { isAutoplay, mountReel } from './reel/reel.js';

const post = document.querySelector('.post');
const like = post.querySelector('.like');
const heart = like.querySelector('.heart');
const inks = like.querySelectorAll('.heart-ink');
const offRegister = like.querySelector('.heart-ink.ink2');
const art = post.querySelector('.art');
const stampEl = art.querySelector('.stamp');
const odometer = post.querySelector('.odometer');
const countText = post.querySelector('.count-text');
const status = document.querySelector('[role="status"]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The reel and its recordings always use the light theme.
if (isAutoplay) document.documentElement.dataset.reel = '';

const START = 1203;
let count = START;
let liked = false;
let lastStamp = 0;

const format = (n) => n.toLocaleString('en-US');
const ink = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- Odometer ---------- */

function renderCount(n) {
  odometer.replaceChildren(...[...format(n)].map((ch) => {
    const cell = document.createElement('span');
    cell.className = /\d/.test(ch) ? 'digit' : 'sep';
    cell.innerHTML = /\d/.test(ch) ? `<span>${ch}</span>` : ch;
    return cell;
  }));
}

/** Rolls only the digits that changed: up when the count grows, down when it shrinks. */
function rollTo(n, direction) {
  const next = format(n);
  const cells = [...odometer.children];
  const busy = cells.some((cell) => cell.childElementCount > 1); // a roll is still running
  if (cells.length !== next.length || busy || reduceMotion.matches) return renderCount(n);
  cells.forEach((cell, i) => {
    const old = cell.firstElementChild;
    if (!old || old.textContent === next[i]) return;
    const fresh = document.createElement('span');
    fresh.textContent = next[i];
    fresh.style.position = 'absolute';
    fresh.style.inset = '0';
    cell.append(fresh);
    const timing = { duration: 380, delay: i * 30, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both' };
    old.animate({ translate: ['0 0', `0 ${-100 * direction}%`], opacity: [1, 0] }, timing);
    fresh.animate({ translate: [`0 ${100 * direction}%`, '0 0'], opacity: [0, 1] }, timing).finished.then(() => {
      old.remove();
      fresh.removeAttribute('style');
      fresh.getAnimations().forEach((a) => a.cancel());
    });
  });
}

/* ---------- Burst of halftone dots ---------- */

/**
 * Throws a ring of dots out of the centre of `host`, alternating the two inks, like the screen
 * dots of a riso print scattering. Each dot is one WAAPI animation and removes itself.
 */
function burst(host, { count: n = 12, distance = 38, size = [5, 9], colors, delay = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    const d = size[0] + Math.random() * (size[1] - size[0]);
    const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const reach = distance * (0.8 + Math.random() * 0.4);
    Object.assign(dot.style, { width: `${d}px`, height: `${d}px`, margin: `${-d / 2}px 0 0 ${-d / 2}px`, background: colors[i % colors.length] });
    host.append(dot);
    dot.animate(
      [
        { translate: '0 0', scale: 0.4, opacity: 0 },
        { translate: '0 0', scale: 0.4, opacity: 1, offset: 0.04 },
        { translate: `${Math.cos(angle) * reach}px ${Math.sin(angle) * reach}px`, scale: 1, opacity: 1, offset: 0.6 },
        { translate: `${Math.cos(angle) * reach * 1.12}px ${Math.sin(angle) * reach * 1.12}px`, scale: 0, opacity: 0 },
      ],
      { duration: 620, delay, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)', fill: 'backwards' },
    ).finished.then(() => dot.remove());
  }
}

function ring(host, delay = 0) {
  const el = document.createElement('span');
  el.className = 'ring';
  host.append(el);
  el.animate({ scale: [0.3, 1.5], opacity: [1, 0] }, { duration: 460, delay, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'backwards' })
    .finished.then(() => el.remove());
}

/* ---------- Like and unlike ---------- */

function setLiked(next) {
  if (next === liked) return;
  liked = next;
  count += next ? 1 : -1;
  like.setAttribute('aria-pressed', String(next));
  countText.textContent = format(count);
  status.textContent = next ? `Liked. ${format(count)} likes` : `Like removed. ${format(count)} likes`;
  rollTo(count, next ? 1 : -1);
  if (reduceMotion.matches) return;
  if (next) inkIn();
  else inkOut();
}

/** Like: the heart squashes and pops, both inks flood in from the bottom, the peach one snaps
 *  (almost) into register, and dots burst out. */
function inkIn() {
  heart.animate(
    { scale: [1, 0.72, 1.32, 0.92, 1.05, 1], offset: [0, 0.14, 0.42, 0.66, 0.84, 1] },
    { duration: 620, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
  for (const layer of inks) {
    layer.animate(
      { clipPath: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'] },
      { duration: 340, delay: 60, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'backwards' },
    );
  }
  offRegister.animate(
    { translate: ['13px -9px', '4px 3px'] },
    { duration: 560, delay: 60, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
  );
  ring(like, 110);
  burst(like, { count: 12, distance: 38, colors: [ink('--ink1'), ink('--ink2')], delay: 110 });
}

/** Unlike: the ink drains out from the top and the heart gives a small, sad dip. */
function inkOut() {
  heart.animate({ scale: [1, 0.8, 1.06, 1] }, { duration: 380, easing: 'ease-out' });
  for (const layer of inks) {
    layer.animate({ clipPath: ['inset(0 0 0 0)', 'inset(100% 0 0 0)'] }, { duration: 300, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' });
  }
}

/** Double tap on the print: a big heart is stamped on it, ink splashes, and the post is liked. */
function stamp() {
  const now = performance.now();
  if (now - lastStamp < 400) return; // dblclick and the touch double-tap can both fire
  lastStamp = now;
  if (!reduceMotion.matches) {
    stampEl.getAnimations().forEach((a) => a.cancel());
    stampEl.animate(
      [
        { opacity: 0, scale: 1.9, rotate: '-20deg', filter: 'blur(8px)' },
        { opacity: 1, scale: 0.9, rotate: '-6deg', filter: 'blur(0px)', offset: 0.26 },
        { opacity: 1, scale: 1, rotate: '-9deg', offset: 0.36 },
        { opacity: 1, scale: 1, rotate: '-9deg', offset: 0.76 },
        { opacity: 0, scale: 1.14, rotate: '-9deg' },
      ],
      { duration: 1400, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    );
    burst(art, { count: 16, distance: 120, size: [8, 16], colors: ['#741a2f', '#fff8f2'], delay: 330 });
  }
  setLiked(true);
}

like.addEventListener('click', () => setLiked(!liked));
art.addEventListener('dblclick', stamp);
let lastTap = 0;
art.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'touch') return;
  if (event.timeStamp - lastTap < 300) stamp();
  lastTap = event.timeStamp;
});

renderCount(count);

function reset() {
  for (const el of [heart, stampEl, ...inks]) el.getAnimations().forEach((a) => a.cancel());
  post.querySelectorAll('.dot, .ring').forEach((el) => el.remove());
  liked = false;
  count = START;
  lastStamp = 0;
  like.setAttribute('aria-pressed', 'false');
  countText.textContent = format(count);
  renderCount(count);
  status.textContent = '';
}

/* ---------- Reel mode ---------- */

mountReel({
  eyebrow: 'UI animation #09',
  title: 'Leave a',
  accent: 'like.',
  demo: post,
  demoScale: 1.9,
  file: 'like-button-animation/script.js',
  code: `
// Both inks flood the heart from the bottom,
// and the peach one snaps into register.
for (const layer of inks) {
  layer.animate(
    { clipPath: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'] },
    { duration: 340, delay: 60, fill: 'backwards' },
  );
}
offRegister.animate(
  { translate: ['13px -9px', '4px 3px'] },
  { duration: 560, delay: 60, fill: 'backwards' },
);`,
  reset,
  async play({ cursor, sleep }) {
    await sleep(700);
    await cursor.click(like);       // like
    cursor.park();
    await sleep(1700);
    await cursor.click(like);       // unlike
    await sleep(1100);
    await cursor.moveTo(art);       // double tap the print
    await cursor.click();
    await sleep(40);
    await cursor.click();
    art.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    cursor.park();
    await sleep(2600);
  },
});
