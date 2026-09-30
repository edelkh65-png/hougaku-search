// 楽曲データの読み込み（Supabase、未設定なら data.js のデータ）
// 戻り値：{ instruments: {key: {label, family, aliases}}, pieces: [...] }
//   piece.instruments: [{ key, parts, notation, solo, optional }]
async function loadMusicData() {
  const config = window.MUSIC_DB || {};
  if (!config.url || !config.key) return loadLocalData();

  const base = `${config.url.replace(/\/+$/, '')}/rest/v1/`;
  const PAGE = 1000; // Supabase が1回に返す最大件数

  async function getAll(path) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await fetch(`${base}${path}&limit=${PAGE}&offset=${offset}`, { headers: { apikey: config.key } });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const page = await res.json();
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  const [instrumentRows, pieceRows] = await Promise.all([
    getAll('instruments?select=key,label,family,aliases&order=sort_order,id'),
    getAll('pieces?select=title,reading,subtitle,category,arranger,year,year_label,remarks,'
      + 'composer:composers(name),'
      + 'piece_instruments(parts,is_solo,is_optional,notation,position,instrument:instruments(key))&order=id'),
  ]);

  const instruments = {};
  instrumentRows.forEach((row) => {
    instruments[row.key] = { label: row.label, family: row.family, aliases: row.aliases || [] };
  });

  const pieces = pieceRows.map((row) => ({
    title: row.title,
    reading: row.reading || '',
    subtitle: row.subtitle || '',
    category: row.category || '',
    composer: row.composer ? row.composer.name : '',
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
  }));

  return { instruments, pieces };
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
  const pieces = PIECES.map((p) => Object.assign({
    reading: '', subtitle: '', category: '', composer: '', arranger: '', year: null, yearLabel: '', remarks: '',
  }, p, {
    instruments: p.instruments.map(([key, parts, notation, solo, optional]) => ({
      key, parts, notation: notation || '', solo: !!solo, optional: !!optional,
    })),
  }));
  return { instruments: INSTRUMENTS, pieces };
}
