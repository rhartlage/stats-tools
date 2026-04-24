const svg = document.getElementById('chart');
const randomBtn = document.getElementById('randomBtn');
const clearBtn = document.getElementById('clearBtn');

const countEl = document.getElementById('count');
const slopeEl = document.getElementById('slope');
const interceptEl = document.getElementById('intercept');
const mseEl = document.getElementById('mse');
const r2El = document.getElementById('r2');

const W = 800, H = 500, P = 45;
const domain = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
const pts = [];

const mapX = x => P + ((x - domain.minX) / (domain.maxX - domain.minX)) * (W - 2 * P);
const mapY = y => H - P - ((y - domain.minY) / (domain.maxY - domain.minY)) * (H - 2 * P);
const unmapX = px => domain.minX + ((px - P) / (W - 2 * P)) * (domain.maxX - domain.minX);
const unmapY = py => domain.minY + ((H - P - py) / (H - 2 * P)) * (domain.maxY - domain.minY);
const mean = a => a.reduce((s, n) => s + n, 0) / (a.length || 1);

function fit(data) {
  if (data.length < 2) return null;
  const xs = data.map(p => p.x), ys = data.map(p => p.y);
  const xBar = mean(xs), yBar = mean(ys);
  let num = 0, den = 0;
  for (const p of data) { num += (p.x - xBar) * (p.y - yBar); den += (p.x - xBar) ** 2; }
  if (den === 0) return null;
  const m = num / den, b = yBar - m * xBar;
  const err = data.map(p => p.y - (m * p.x + b));
  const mse = mean(err.map(e => e * e));
  const tss = ys.reduce((s, y) => s + (y - yBar) ** 2, 0);
  const rss = err.reduce((s, e) => s + e * e, 0);
  const r2 = tss === 0 ? 1 : 1 - rss / tss;
  return { m, b, mse, r2 };
}

function add(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  svg.appendChild(el);
}

function drawGrid() {
  for (let i = 0; i <= 10; i++) {
    const x = P + (i / 10) * (W - 2 * P);
    const y = P + (i / 10) * (H - 2 * P);
    add('line', { x1: x, y1: P, x2: x, y2: H - P, class: 'grid' });
    add('line', { x1: P, y1: y, x2: W - P, y2: y, class: 'grid' });
  }
  add('line', { x1: P, y1: H - P, x2: W - P, y2: H - P, class: 'axis' });
  add('line', { x1: P, y1: P, x2: P, y2: H - P, class: 'axis' });
}

function render() {
  svg.innerHTML = '';
  drawGrid();
  const f = fit(pts);

  if (f) {
    add('line', {
      x1: mapX(domain.minX), y1: mapY(f.m * domain.minX + f.b),
      x2: mapX(domain.maxX), y2: mapY(f.m * domain.maxX + f.b),
      class: 'fit'
    });
  }

  for (const p of pts) add('circle', { cx: mapX(p.x), cy: mapY(p.y), r: 5, class: 'point' });

  countEl.textContent = pts.length;
  slopeEl.textContent = f ? f.m.toFixed(4) : '—';
  interceptEl.textContent = f ? f.b.toFixed(4) : '—';
  mseEl.textContent = f ? f.mse.toFixed(4) : '—';
  r2El.textContent = f ? f.r2.toFixed(4) : '—';
}

svg.addEventListener('click', e => {
  const r = svg.getBoundingClientRect();
  const px = ((e.clientX - r.left) / r.width) * W;
  const py = ((e.clientY - r.top) / r.height) * H;
  if (px < P || px > W - P || py < P || py > H - P) return;
  pts.push({ x: unmapX(px), y: unmapY(py) });
  render();
});

randomBtn.addEventListener('click', () => {
  pts.length = 0;
  const m = Math.random() * 1.4 - 0.7;
  const b = 20 + Math.random() * 60;
  for (let i = 0; i < 25; i++) {
    const x = 5 + Math.random() * 90;
    const y = m * x + b + (Math.random() * 20 - 10);
    pts.push({ x, y });
  }
  render();
});

clearBtn.addEventListener('click', () => { pts.length = 0; render(); });
render();
