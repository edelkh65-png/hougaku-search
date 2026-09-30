// 楽曲データの読み込み（Supabase、未設定なら data.js のサンプルデータ）
async function loadMusicData() {
  const config = window.MUSIC_DB || {};
  if (!config.url || !config.key) {
    return { instruments: INSTRUMENTS, pieces: PIECES };
  }

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
    getAll('pieces?select=title,original,year,era,setting,note,'
      + 'composer:composers(name,name_original),'
      + 'piece_instruments(count,is_solo,position,instrument:instruments(key))&order=id'),
  ]);

  const instruments = {};
  instrumentRows.forEach((row) => {
    instruments[row.key] = { label: row.label, family: row.family, aliases: row.aliases || [] };
  });

  const pieces = pieceRows.map((row) => ({
    title: row.title,
    original: row.original || '',
    composer: row.composer.name,
    composerOriginal: row.composer.name_original || '',
    year: row.year,
    era: row.era,
    setting: row.setting,
    note: row.note || undefined,
    instruments: row.piece_instruments
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((pi) => [pi.instrument.key, pi.count, pi.is_solo ? 'solo' : undefined]),
  }));

  return { instruments, pieces };
}
