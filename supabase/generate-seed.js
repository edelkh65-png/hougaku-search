// data.js のサンプルデータから Supabase 登録用の seed.sql を生成します。
//   node music/supabase/generate-seed.js > music/supabase/seed.sql
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const { INSTRUMENTS, PIECES } = vm.runInNewContext(`${source}; ({ INSTRUMENTS, PIECES })`);

const str = (value) => (value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const arr = (values) => `array[${values.map(str).join(', ')}]::text[]`;

const out = ['-- 楽曲検索アプリの初期データ（generate-seed.js で生成）', '-- schema.sql の実行後に、SQL Editor で1回だけ実行してください。', 'begin;', ''];

out.push('insert into instruments (key, label, family, aliases, sort_order) values');
out.push(Object.entries(INSTRUMENTS)
  .map(([key, i], n) => `  (${str(key)}, ${str(i.label)}, ${str(i.family)}, ${arr(i.aliases)}, ${n})`)
  .join(',\n') + ';', '');

const composers = [...new Map(PIECES.map((p) => [`${p.composer}\t${p.composerOriginal}`, p])).values()];
out.push('insert into composers (name, name_original) values');
out.push(composers.map((p) => `  (${str(p.composer)}, ${str(p.composerOriginal)})`).join(',\n') + ';', '');

PIECES.forEach((p) => {
  const rows = p.instruments.map(([key, count, role], n) =>
    `(${str(key)}, ${count === null || count === undefined ? 'null' : count}::int, ${role === 'solo'}, ${n})`);
  out.push(
    'with p as (',
    '  insert into pieces (title, original, composer_id, year, era, setting, note)',
    `  select ${str(p.title)}, ${str(p.original)}, c.id, ${p.year}, ${str(p.era)}, ${str(p.setting)}, ${str(p.note)}`,
    `  from composers c where c.name = ${str(p.composer)} and c.name_original = ${str(p.composerOriginal)}`,
    '  returning id',
    ')',
    'insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)',
    'select p.id, i.id, v.count, v.is_solo, v.position',
    `from p, (values ${rows.join(', ')}) as v (key, count, is_solo, position)`,
    'join instruments i on i.key = v.key;',
    '',
  );
});

out.push('commit;');
process.stdout.write(out.join('\n') + '\n');
