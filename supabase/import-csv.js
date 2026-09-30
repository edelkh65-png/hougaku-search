// 楽曲リスト（CSV）から、アプリ用の data.js と Supabase 登録用の seed.sql を生成します。
//   node music/supabase/import-csv.js [CSVファイル]   （省略時は music/supabase/songs.csv）
//
// CSV の列：分類,曲名,よみがな,副題,作曲者,編曲者,作曲年,箏,十七絃,尺八,三絃,二十絃,二十五絃,三十絃,琵琶,笙,合唱,笛,他楽器,備考
// 文字コードは Shift_JIS（Excel の標準）と UTF-8 のどちらでも読めます。
const fs = require('fs');
const path = require('path');

const CSV_PATH = process.argv[2] || path.join(__dirname, 'songs.csv');
const MUSIC_DIR = path.join(__dirname, '..');

// ---- 楽器の定義（この順で検索画面に並びます） ----
// ensemble: true の楽器は人数を決めない編成（人数の指定がなければ「人数不明」扱い）
const INSTRUMENTS = {
  koto:        { label: '箏',             family: 'koto',       aliases: ['琴', 'こと', 'そう'] },
  jushichigen: { label: '十七絃',         family: 'koto',       aliases: ['十七弦', '17絃'] },
  nijugen:     { label: '二十絃',         family: 'koto',       aliases: ['二十弦', '20絃'] },
  nijugogen:   { label: '二十五絃',       family: 'koto',       aliases: ['二十五弦', '25絃'] },
  sanjugen:    { label: '三十絃',         family: 'koto',       aliases: ['三十弦', '30絃'] },
  tagenso:     { label: '多絃箏（その他）', family: 'koto',     aliases: ['十八絃', '十五絃'] },
  sangen:      { label: '三絃',           family: 'shamisen',   aliases: ['三弦', '三味線', 'しゃみせん', '太棹'] },
  biwa:        { label: '琵琶',           family: 'shamisen',   aliases: ['びわ'] },
  kokyu:       { label: '胡弓',           family: 'shamisen',   aliases: ['こきゅう'] },
  shakuhachi:  { label: '尺八',           family: 'kan',        aliases: ['しゃくはち'] },
  fue:         { label: '笛',             family: 'kan',        aliases: ['竹笛'] },
  shinobue:    { label: '篠笛',           family: 'kan',        aliases: ['しのぶえ'] },
  ryuteki:     { label: '龍笛',           family: 'kan',        aliases: ['竜笛', 'りゅうてき'] },
  nokan:       { label: '能管',           family: 'kan',        aliases: ['のうかん'] },
  hichiriki:   { label: '篳篥',           family: 'kan',        aliases: ['ひちりき'] },
  sho:         { label: '笙',             family: 'kan',        aliases: ['しょう'] },
  percussion:  { label: '打楽器',         family: 'percussion', aliases: ['打物', '打ち物', 'Perc', 'パーカッション'] },
  taiko:       { label: '太鼓',           family: 'percussion', aliases: ['締太鼓', '〆太鼓', '大太鼓', '桶胴', 'おけ胴'] },
  tsuzumi:     { label: '鼓',             family: 'percussion', aliases: ['小鼓', '大鼓'] },
  marimba:     { label: 'マリンバ',       family: 'percussion', aliases: [] },
  uta:         { label: '歌・唄',         family: 'voice',      aliases: ['歌', '唄', '独唱', '声', 'ソプラノ', 'メゾソプラノ', 'アルト', 'テノール', 'テナー', 'バリトン'] },
  chorus:      { label: '合唱',           family: 'voice',      aliases: ['コーラス', '女声', '男声', '混声', '児童'], ensemble: true },
  katari:      { label: '語り',           family: 'voice',      aliases: ['語り手', '朗読', 'ナレーション'] },
  piano:       { label: 'ピアノ',         family: 'western',    aliases: ['Pf'] },
  harpsichord: { label: 'チェンバロ',     family: 'western',    aliases: ['ハープシコード'] },
  violin:      { label: 'ヴァイオリン',   family: 'western',    aliases: ['バイオリン', 'Vn', 'Vl'] },
  viola:       { label: 'ヴィオラ',       family: 'western',    aliases: ['ビオラ', 'Va', 'Vla'] },
  cello:       { label: 'チェロ',         family: 'western',    aliases: ['Vc'] },
  contrabass:  { label: 'コントラバス',   family: 'western',    aliases: ['Cb'] },
  flute:       { label: 'フルート',       family: 'western',    aliases: ['Fl', 'Flute'] },
  oboe:        { label: 'オーボエ',       family: 'western',    aliases: ['Ob'] },
  clarinet:    { label: 'クラリネット',   family: 'western',    aliases: ['Cl'] },
  bassoon:     { label: 'ファゴット',     family: 'western',    aliases: ['Fg', 'バスーン'] },
  saxophone:   { label: 'サクソフォン',   family: 'western',    aliases: ['Sax', 'サックス'] },
  recorder:    { label: 'リコーダー',     family: 'western',    aliases: ['Rc'] },
  guitar:      { label: 'ギター',         family: 'western',    aliases: ['Guit'] },
  mandolin:    { label: 'マンドリン',     family: 'western',    aliases: ['Mnd'] },
  strings:     { label: '弦楽合奏',       family: 'western',    aliases: ['弦楽四重奏'], ensemble: true },
  orchestra:   { label: 'オーケストラ',   family: 'western',    aliases: ['Orch', 'Och', '管弦楽'], ensemble: true },
  band:        { label: '吹奏楽',         family: 'western',    aliases: ['ブラスバンド'], ensemble: true },
  asian:       { label: 'アジアの楽器',   family: 'other',      aliases: ['二胡', 'ピパ', '馬頭琴', 'ピリ'] },
  gagaku:      { label: '雅楽器',         family: 'other',      aliases: [], ensemble: true },
  other:       { label: 'その他',         family: 'other',      aliases: [] },
};

// CSV の楽器列と楽器の対応
const COLUMN_INSTRUMENTS = {
  '箏': 'koto', '十七絃': 'jushichigen', '尺八': 'shakuhachi', '三絃': 'sangen', '二十絃': 'nijugen',
  '二十五絃': 'nijugogen', '三十絃': 'sanjugen', '琵琶': 'biwa', '笙': 'sho',
};

// 「笛」「他楽器」列の記述と楽器の対応（上から順に判定）
const TOKEN_RULES = [
  [/^(orch|och)/i, 'orchestra'],
  [/^弦楽/, 'strings'],
  [/^ブラスバンド/, 'band'],
  [/^ハープシコード/, 'harpsichord'],
  [/^pf/i, 'piano'],
  [/^(vn|vl)\b/i, 'violin'],
  [/^(va|vla)\b/i, 'viola'],
  [/^(vc\b|チェロ)/i, 'cello'],
  [/^cb\b/i, 'contrabass'],
  [/(^fl\b|^flute|^アルトfl)/i, 'flute'],
  [/^ob\b/i, 'oboe'],
  [/^cl\b/i, 'clarinet'],
  [/^fg\b/i, 'bassoon'],
  [/^sax/i, 'saxophone'],
  [/^(リコーダー|rc\b)/i, 'recorder'],
  [/^(ギター|guit)/i, 'guitar'],
  [/^mnd\b/i, 'mandolin'],
  [/^マリンバ/, 'marimba'],
  [/^胡弓/, 'kokyu'],
  [/^(太棹|三絃|三弦)/, 'sangen'],
  [/^(十八絃|十五絃)/, 'tagenso'],
  [/^篠笛/, 'shinobue'],
  [/^(龍笛|竜笛)/, 'ryuteki'],
  [/^能管/, 'nokan'],
  [/^篳篥/, 'hichiriki'],
  [/^(笛|竹笛)/, 'fue'],
  [/^(打楽器|打物|打ち物|perc)/i, 'percussion'],
  [/(太鼓|桶胴|おけ胴)/, 'taiko'],
  [/^(小鼓|大鼓|鼓)$/, 'tsuzumi'],
  [/^(木魚|チャッパ|鉦皷|timp|cym|tamtam|ドイラ|囃子)/i, 'percussion'],
  [/^(語り|朗読|お話)/, 'katari'],
  [/(声|唄|歌|ソプラノ|テノール|テナー|バリトン|独唱|弾き語り)/, 'uta'],
  [/^(二胡|中国|ピパ|大三弦|馬頭琴|ピリ|韓国|東洋)/, 'asian'],
  [/^雅楽器/, 'gagaku'],
];

// ---- CSV の読み込み ----
function decode(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.toString('utf8', 3);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) { /* UTF-8 でなければ Shift_JIS として読む */ }

  // Mac で保存された Shift_JIS 特有の文字（ローマ数字、ゔ）を置き換えながら読む
  const MAC_CHARS = { 0x859f: 'Ⅰ', 0x85a0: 'Ⅱ', 0x85a1: 'Ⅲ', 0x85a2: 'Ⅳ', 0x85a3: 'Ⅴ', 0x85a4: 'Ⅵ', 0x8868: 'ゔ' };
  const sjis = new TextDecoder('shift_jis');
  let text = '';
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (!((b >= 0x81 && b <= 0x9f) || (b >= 0xe0 && b <= 0xfc))) continue;
    const char = MAC_CHARS[(b << 8) | buf[i + 1]];
    if (char) {
      text += sjis.decode(buf.subarray(start, i)) + char;
      start = i + 2;
    }
    i++;
  }
  text += sjis.decode(buf.subarray(start));

  const bad = text.split(/\r?\n/).findIndex((line) => line.includes('�'));
  if (bad >= 0) throw new Error(`${bad + 1}行目に読めない文字があります: ${text.split(/\r?\n/)[bad]}`);
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- 楽器欄の解釈 ----
// 例：'2' → 2人、'独+2' → 独奏1人+2人、'(1)' → 省略可、'●' → 人数不明、'2(各AB)' → 2人
function parseCount(text) {
  const t = text.trim();
  const optional = /^\(.*\)$/.test(t) || t.includes('省略可');
  const inner = t.replace(/^\((.*)\)$/, '$1');
  if (inner.startsWith('独')) {
    const m = inner.match(/^独(\d*)(?:\([^)]*\))?(?:\+(.*))?$/);
    if (!m) return { parts: null, solo: true, optional };
    const solo = m[1] ? Number(m[1]) : 1;
    if (m[2] === undefined) return { parts: solo, solo: true, optional };
    const rest = m[2].match(/^(\d+)/);
    return { parts: rest ? solo + Number(rest[1]) : null, solo: true, optional };
  }
  if (inner === '本,替') return { parts: 2, solo: false, optional };
  const m = inner.match(/(\d+)/);
  return { parts: m ? Number(m[1]) : null, solo: false, optional };
}

// 括弧の外にある区切り文字で分割
function splitTokens(text) {
  const tokens = [];
  let depth = 0;
  let current = '';
  for (const c of text) {
    if ('(（'.includes(c)) depth++;
    if (')）'.includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0 && ',，、'.includes(c)) { tokens.push(current); current = ''; }
    else current += c;
  }
  tokens.push(current);
  return tokens.map((t) => t.trim()).filter(Boolean);
}

function isPlainName(base, key) {
  const name = base.replace(/\.$/, '').toLowerCase();
  const inst = INSTRUMENTS[key];
  if (name === inst.label.toLowerCase()) return true;
  return /^[a-z]+$/.test(name) && inst.aliases.some((a) => a.toLowerCase() === name);
}

// 「笛」「他楽器」列の1項目を楽器に変換
function parseToken(token) {
  const m = token.match(/^(.*?)(\d+)$/);
  const base = m ? m[1] : token;
  const count = m ? Number(m[2]) : null;
  const rule = TOKEN_RULES.find(([re]) => re.test(base));
  const key = rule ? rule[1] : 'other';
  return {
    key,
    parts: count || (INSTRUMENTS[key].ensemble || /(群|合奏|囃子)/.test(token) ? null : 1),
    notation: isPlainName(base, key) ? '' : token,
    solo: /solo|ソロ|独唱/i.test(token),
    optional: token.includes('省略可'),
  };
}

function parseRow(cols, header) {
  const get = (name) => (cols[header.indexOf(name)] || '').trim();
  const instruments = [];

  Object.entries(COLUMN_INSTRUMENTS).forEach(([column, key]) => {
    const cell = get(column);
    if (!cell) return;
    const { parts, solo, optional } = parseCount(cell);
    const plain = cell === '●' || /^\d+$/.test(cell);
    instruments.push({ key, parts, notation: plain ? '' : `${INSTRUMENTS[key].label} ${cell}`, solo, optional });
  });

  const chorus = get('合唱');
  if (chorus) {
    const plain = ['合唱', 'コーラス'].includes(chorus);
    instruments.push({ key: 'chorus', parts: null, notation: plain ? '' : `合唱（${chorus}）`, solo: false, optional: chorus.includes('省略可') });
  }
  splitTokens(get('笛')).forEach((t) => instruments.push(parseToken(t)));
  splitTokens(get('他楽器')).forEach((t) => instruments.push(parseToken(t)));

  const yearText = get('作曲年');
  const year = yearText.match(/\d{4}/);
  return {
    title: get('曲名'),
    reading: get('よみがな'),
    subtitle: get('副題'),
    category: get('分類'),
    composer: get('作曲者'),
    arranger: get('編曲者'),
    year: year ? Number(year[0]) : null,
    yearLabel: year && yearText !== year[0] ? yearText : '',
    remarks: get('備考'),
    instruments,
  };
}

// ---- 出力 ----
function toDataJs(pieces) {
  const compact = (p) => {
    const o = { title: p.title };
    ['reading', 'subtitle', 'category', 'composer', 'arranger', 'year', 'yearLabel', 'remarks'].forEach((k) => {
      if (p[k]) o[k] = p[k];
    });
    // [楽器キー, 人数, 表記, 独奏, 省略可]
    o.instruments = p.instruments.map((i) => {
      const a = [i.key, i.parts, i.notation, i.solo ? 1 : 0, i.optional ? 1 : 0];
      while (a.length > 2 && !a[a.length - 1]) a.pop();
      return a;
    });
    return JSON.stringify(o);
  };
  const instruments = Object.entries(INSTRUMENTS)
    .map(([k, v]) => `  ${k}: ${JSON.stringify({ label: v.label, family: v.family, aliases: v.aliases })},`);
  return [
    '// 楽曲データ（Supabase 未接続のときに使います）',
    '// このファイルは supabase/import-csv.js で自動生成しています。直接編集しないでください。',
    'const INSTRUMENTS = {', ...instruments, '};', '',
    '// instruments: [楽器キー, 人数（null は不明）, 表記, 独奏, 省略可]',
    'const PIECES = [', ...pieces.map((p) => `  ${compact(p)},`), '];', '',
  ].join('\n');
}

function toSeedSql(pieces) {
  const s = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const t = (v) => `'${String(v || '').replace(/'/g, "''")}'`; // 空文字を許す列
  const n = (v) => (v === null || v === undefined ? 'null' : String(v));

  const composers = [...new Set(pieces.map((p) => p.composer).filter(Boolean))];
  const composerId = new Map(composers.map((c, i) => [c, i + 1]));
  const instrumentKeys = Object.keys(INSTRUMENTS);
  const instrumentId = new Map(instrumentKeys.map((k, i) => [k, i + 1]));

  const links = [];
  pieces.forEach((p, pi) => p.instruments.forEach((i, pos) => links.push(
    `  (${pi + 1}, ${instrumentId.get(i.key)}, ${n(i.parts)}, ${i.solo}, ${i.optional}, ${t(i.notation)}, ${pos})`)));

  return [
    '-- 楽曲データの登録（import-csv.js で songs.csv から生成）',
    '-- schema.sql の実行後に、SQL Editor で実行してください。',
    `-- 楽曲 ${pieces.length}曲 / 作曲者 ${composers.length}人 / 楽器 ${instrumentKeys.length}種類`,
    'begin;', '',
    'insert into instruments (id, key, label, family, aliases, sort_order) overriding system value values',
    instrumentKeys.map((k, i) => {
      const v = INSTRUMENTS[k];
      const aliases = `array[${v.aliases.map(t).join(', ')}]::text[]`;
      return `  (${i + 1}, ${t(k)}, ${t(v.label)}, ${t(v.family)}, ${aliases}, ${i})`;
    }).join(',\n') + ';', '',
    'insert into composers (id, name) overriding system value values',
    composers.map((c) => `  (${composerId.get(c)}, ${t(c)})`).join(',\n') + ';', '',
    'insert into pieces (id, title, reading, subtitle, category, composer_id, arranger, year, year_label, remarks) overriding system value values',
    pieces.map((p, i) => `  (${i + 1}, ${t(p.title)}, ${t(p.reading)}, ${t(p.subtitle)}, ${s(p.category)}, ${n(composerId.get(p.composer))}, `
      + `${t(p.arranger)}, ${n(p.year)}, ${t(p.yearLabel)}, ${t(p.remarks)})`).join(',\n') + ';', '',
    'insert into piece_instruments (piece_id, instrument_id, parts, is_solo, is_optional, notation, position) values',
    links.join(',\n') + ';', '',
    '-- 今後 Table Editor で追加する行の id が重ならないように、連番を進める',
    "select setval(pg_get_serial_sequence('instruments', 'id'), (select max(id) from instruments));",
    "select setval(pg_get_serial_sequence('composers', 'id'), (select max(id) from composers));",
    "select setval(pg_get_serial_sequence('pieces', 'id'), (select max(id) from pieces));",
    '', 'commit;', '',
  ].join('\n');
}

// ---- 実行 ----
const rows = parseCsv(decode(fs.readFileSync(CSV_PATH)));
const header = rows[0].map((h) => h.trim());
['曲名', ...Object.keys(COLUMN_INSTRUMENTS), '他楽器'].forEach((name) => {
  if (!header.includes(name)) throw new Error(`CSV に「${name}」列がありません`);
});
const pieces = rows.slice(1).filter((cols) => (cols[header.indexOf('曲名')] || '').trim()).map((cols) => parseRow(cols, header));

fs.writeFileSync(path.join(MUSIC_DIR, 'data.js'), toDataJs(pieces));
fs.writeFileSync(path.join(__dirname, 'seed.sql'), toSeedSql(pieces));

const others = pieces.flatMap((p) => p.instruments.filter((i) => i.key === 'other').map((i) => `${p.title}: ${i.notation}`));
console.log(`${pieces.length}曲を書き出しました（data.js, supabase/seed.sql）`);
if (others.length) console.log(`「その他」に分類した楽器 ${others.length}件:\n  ${others.join('\n  ')}`);
