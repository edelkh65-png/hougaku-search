// 小さな舞台図（楽器編成を、客席から見た半円に奏者の点で並べる）
// 検索ページのカードと「舞台で探す」の結果で使う。色は style.css の .fam-〇〇（楽器のジャンル）
//   instruments: [{ key, parts }]（parts が空の楽器は1人として白抜きの点）
//   familyOf: 楽器キー → ジャンル（koto・kan など）
function createMiniStage(instruments, familyOf) {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };
  const dots = [];
  instruments.forEach((i) => {
    for (let k = 0; k < (i.parts || 1); k++) dots.push({ fam: familyOf(i.key), unknown: !i.parts });
  });
  const s = make('svg', { viewBox: '0 0 96 38', class: 'mini', 'aria-hidden': 'true' });
  s.appendChild(make('line', { x1: 4, y1: 36, x2: 92, y2: 36 }));
  const n = dots.length;
  const r = n > 12 ? 2.6 : 3.4;
  // 人数が少ないときは中央に低く寄せ、多いときは半円いっぱいに広げる
  const span = Math.min(0.8, 0.14 * (n - 1));
  dots.forEach((d, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = Math.PI * (0.5 - span / 2 + span * t);
    const rr = n > 8 ? (i % 2 ? 0.62 : 0.88) : 0.8;
    s.appendChild(make('circle', {
      cx: (48 - Math.cos(a) * 42 * rr).toFixed(1),
      cy: (34 - Math.sin(a) * 28 * rr * (0.45 + (0.55 * span) / 0.8)).toFixed(1),
      r,
      class: `fam-${d.fam}${d.unknown ? ' is-unknown' : ''}`,
      'stroke-width': 1.2,
    }));
  });
  return s;
}
