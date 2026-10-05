// 楽曲データの読み込み（Supabase、未設定なら data.js のデータ）
// 戻り値：{ instruments: {key: {label, family, aliases}}, pieces: [...] }
//   piece.id は Supabase の pieces.id（data.js では並び順 + 1 で、seed.sql の id と同じ）
//   piece.composerReading は作曲者名の読み（data.js では空。並び替えは作曲者名で代用）
//   piece.category は分類名、piece.categoryColor は印の色（categories.color）
//   piece.instruments: [{ key, parts, notation, solo, optional }]
//   非表示（hidden）の分類の曲は含まない（Supabase では読み取り権限の設定で除外される）
const PIECE_SELECT = 'id,title,reading,subtitle,arranger,year,year_label,remarks,'
  + 'category:categories(name,color),'
  + 'composer:composers(name,reading),'
  + 'piece_instruments(parts,is_solo,is_optional,notation,position,instrument:instruments(key))';

function musicDbConfig() {
  const config = window.MUSIC_DB || {};
  return config.url && config.key ? config : null;
}

async function musicDbGetAll(config, path) {
  const base = `${config.url.replace(/\/+$/, '')}/rest/v1/`;
  const PAGE = 1000; // Supabase が1回に返す最大件数
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${base}${path}&limit=${PAGE}&offset=${offset}`, { headers: { apikey: config.key } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function loadDbInstruments(config) {
  const rows = await musicDbGetAll(config, 'instruments?select=key,label,family,aliases&order=sort_order,id');
  const instruments = {};
  rows.forEach((row) => {
    instruments[row.key] = { label: row.label, family: row.family, aliases: row.aliases || [] };
  });
  return instruments;
}

function pieceFromDbRow(row) {
  return {
    id: row.id,
    title: row.title,
    reading: row.reading || '',
    subtitle: row.subtitle || '',
    category: row.category ? row.category.name : '',
    categoryColor: row.category ? row.category.color : '',
    composer: row.composer ? row.composer.name : '',
    composerReading: row.composer ? row.composer.reading || '' : '',
    arranger: row.arranger || '',
    year: row.year,
    yearLabel: row.year_label || '',
    remarks: row.remarks || '',
    instruments: row.piece_instruments
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((pi) => ({
        key: pi.instrument.key,
        parts: pi.parts,
        notation: pi.notation || '',
        solo: pi.is_solo,
        optional: pi.is_optional,
      })),
  };
}

async function loadMusicData() {
  const config = musicDbConfig();
  if (!config) return loadLocalData();
  const [instruments, rows] = await Promise.all([
    loadDbInstruments(config),
    musicDbGetAll(config, `pieces?select=${PIECE_SELECT}&order=id`),
  ]);
  return { instruments, pieces: rows.map(pieceFromDbRow) };
}

// 1曲分だけ読み込む（見つからなければ piece は null）
async function loadPiece(id) {
  const config = musicDbConfig();
  if (!config) {
    const { instruments, pieces } = await loadLocalData();
    return { instruments, piece: pieces.find((p) => p.id === id) || null };
  }
  const [instruments, rows] = await Promise.all([
    loadDbInstruments(config),
    musicDbGetAll(config, `pieces?select=${PIECE_SELECT}&id=eq.${id}`),
  ]);
  return { instruments, piece: rows.length ? pieceFromDbRow(rows[0]) : null };
}

async function loadLocalData() {
  if (typeof PIECES === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('data.js を読み込めませんでした'));
      document.head.appendChild(script);
    });
  }
  const categories = typeof CATEGORIES === 'undefined' ? {} : CATEGORIES;
  const pieces = PIECES.map((p, i) => Object.assign({
    id: i + 1, reading: '', subtitle: '', category: '', composer: '', composerReading: '', arranger: '', year: null, yearLabel: '', remarks: '',
  }, p, {
    categoryColor: p.category && categories[p.category] ? categories[p.category].color : '',
    instruments: p.instruments.map(([key, parts, notation, solo, optional]) => ({
      key, parts, notation: notation || '', solo: !!solo, optional: !!optional,
    })),
  })).filter((p) => !(p.category && categories[p.category] && categories[p.category].hidden));
  return { instruments: INSTRUMENTS, pieces };
}
