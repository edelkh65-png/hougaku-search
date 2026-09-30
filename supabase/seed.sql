-- 楽曲検索アプリの初期データ（generate-seed.js で生成）
-- schema.sql の実行後に、SQL Editor で1回だけ実行してください。
begin;

insert into instruments (key, label, family, aliases, sort_order) values
  ('violin', 'ヴァイオリン', 'strings', array['バイオリン', 'violin']::text[], 0),
  ('viola', 'ヴィオラ', 'strings', array['ビオラ', 'viola']::text[], 1),
  ('cello', 'チェロ', 'strings', array['violoncello', 'cello']::text[], 2),
  ('contrabass', 'コントラバス', 'strings', array['ダブルベース', 'ベース', 'double bass']::text[], 3),
  ('piano', 'ピアノ', 'keyboard', array['piano']::text[], 4),
  ('harpsichord', 'チェンバロ', 'keyboard', array['ハープシコード', 'harpsichord', 'cembalo']::text[], 5),
  ('celesta', 'チェレスタ', 'keyboard', array['celesta']::text[], 6),
  ('piccolo', 'ピッコロ', 'woodwind', array['piccolo']::text[], 7),
  ('flute', 'フルート', 'woodwind', array['flute']::text[], 8),
  ('oboe', 'オーボエ', 'woodwind', array['oboe']::text[], 9),
  ('englishhorn', 'イングリッシュホルン', 'woodwind', array['コーラングレ', 'english horn', 'cor anglais']::text[], 10),
  ('clarinet', 'クラリネット', 'woodwind', array['clarinet']::text[], 11),
  ('bassclarinet', 'バスクラリネット', 'woodwind', array['bass clarinet']::text[], 12),
  ('bassethorn', 'バセットホルン', 'woodwind', array['basset horn']::text[], 13),
  ('bassoon', 'ファゴット', 'woodwind', array['バスーン', 'bassoon', 'fagott']::text[], 14),
  ('contrabassoon', 'コントラファゴット', 'woodwind', array['contrabassoon']::text[], 15),
  ('saxophone', 'サクソフォン', 'woodwind', array['サックス', 'saxophone', 'sax']::text[], 16),
  ('horn', 'ホルン', 'brass', array['horn']::text[], 17),
  ('trumpet', 'トランペット', 'brass', array['trumpet']::text[], 18),
  ('cornet', 'コルネット', 'brass', array['cornet']::text[], 19),
  ('trombone', 'トロンボーン', 'brass', array['trombone']::text[], 20),
  ('euphonium', 'ユーフォニアム', 'brass', array['euphonium']::text[], 21),
  ('tuba', 'チューバ', 'brass', array['tuba']::text[], 22),
  ('timpani', 'ティンパニ', 'percussion', array['timpani']::text[], 23),
  ('percussion', '打楽器（その他）', 'percussion', array['パーカッション', 'percussion']::text[], 24),
  ('harp', 'ハープ', 'plucked', array['harp']::text[], 25),
  ('guitar', 'ギター', 'plucked', array['guitar']::text[], 26),
  ('koto', '箏', 'japanese', array['琴', 'こと', 'koto']::text[], 27),
  ('shakuhachi', '尺八', 'japanese', array['しゃくはち', 'shakuhachi']::text[], 28),
  ('biwa', '琵琶', 'japanese', array['びわ', 'biwa']::text[], 29),
  ('voice', '声楽', 'voice', array['歌', 'ボーカル', 'ソプラノ', 'バリトン', 'voice']::text[], 30);

insert into composers (name, name_original) values
  ('J.S.バッハ', 'Johann Sebastian Bach'),
  ('ベートーヴェン', 'Ludwig van Beethoven'),
  ('ショパン', 'Frédéric Chopin'),
  ('ドビュッシー', 'Claude Debussy'),
  ('タレガ', 'Francisco Tárrega'),
  ('シューベルト', 'Franz Schubert'),
  ('エルガー', 'Edward Elgar'),
  ('フランク', 'César Franck'),
  ('ブラームス', 'Johannes Brahms'),
  ('ラフマニノフ', 'Sergei Rachmaninoff'),
  ('プーランク', 'Francis Poulenc'),
  ('宮城道雄', 'Michio Miyagi'),
  ('モーツァルト', 'Wolfgang Amadeus Mozart'),
  ('ハイドン', 'Joseph Haydn'),
  ('ドヴォルザーク', 'Antonín Dvořák'),
  ('メシアン', 'Olivier Messiaen'),
  ('ヒンデミット', 'Paul Hindemith'),
  ('ストラヴィンスキー', 'Igor Stravinsky'),
  ('メンデルスゾーン', 'Felix Mendelssohn'),
  ('ヴィヴァルディ', 'Antonio Vivaldi'),
  ('チャイコフスキー', 'Pyotr Ilyich Tchaikovsky'),
  ('武満徹', 'Toru Takemitsu'),
  ('ラヴェル', 'Maurice Ravel'),
  ('バーバー', 'Samuel Barber'),
  ('ホルスト', 'Gustav Holst');

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '無伴奏チェロ組曲 第1番 ト長調', 'Cello Suite No. 1 in G major, BWV 1007', c.id, 1720, 'バロック', 'chamber', null
  from composers c where c.name = 'J.S.バッハ' and c.name_original = 'Johann Sebastian Bach'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('cello', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '無伴奏ヴァイオリンのためのパルティータ 第2番 ニ短調', 'Partita No. 2 in D minor, BWV 1004', c.id, 1720, 'バロック', 'chamber', '終曲「シャコンヌ」で知られる'
  from composers c where c.name = 'J.S.バッハ' and c.name_original = 'Johann Sebastian Bach'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ピアノ・ソナタ 第14番 嬰ハ短調「月光」', 'Piano Sonata No. 14, Op. 27 No. 2 "Moonlight"', c.id, 1801, '古典派', 'chamber', null
  from composers c where c.name = 'ベートーヴェン' and c.name_original = 'Ludwig van Beethoven'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piano', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'バラード 第1番 ト短調', 'Ballade No. 1 in G minor, Op. 23', c.id, 1835, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ショパン' and c.name_original = 'Frédéric Chopin'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piano', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '月の光（ベルガマスク組曲 より）', 'Clair de lune (Suite bergamasque)', c.id, 1905, '近現代', 'chamber', null
  from composers c where c.name = 'ドビュッシー' and c.name_original = 'Claude Debussy'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piano', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'シランクス', 'Syrinx', c.id, 1913, '近現代', 'chamber', null
  from composers c where c.name = 'ドビュッシー' and c.name_original = 'Claude Debussy'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('flute', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'アルハンブラの思い出', 'Recuerdos de la Alhambra', c.id, 1896, 'ロマン派', 'chamber', null
  from composers c where c.name = 'タレガ' and c.name_original = 'Francisco Tárrega'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('guitar', 1::int, false, 0)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '魔王', 'Erlkönig, D 328', c.id, 1815, 'ロマン派', 'chamber', 'ゲーテの詩による歌曲'
  from composers c where c.name = 'シューベルト' and c.name_original = 'Franz Schubert'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('voice', 1::int, false, 0), ('piano', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '愛の挨拶', 'Salut d''amour, Op. 12', c.id, 1888, 'ロマン派', 'chamber', null
  from composers c where c.name = 'エルガー' and c.name_original = 'Edward Elgar'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, false, 0), ('piano', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ヴァイオリン・ソナタ イ長調', 'Violin Sonata in A major, FWV 8', c.id, 1886, 'ロマン派', 'chamber', null
  from composers c where c.name = 'フランク' and c.name_original = 'César Franck'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, false, 0), ('piano', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'クラリネット・ソナタ 第1番 ヘ短調', 'Clarinet Sonata No. 1 in F minor, Op. 120 No. 1', c.id, 1894, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ブラームス' and c.name_original = 'Johannes Brahms'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('piano', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'チェロ・ソナタ ト短調', 'Cello Sonata in G minor, Op. 19', c.id, 1901, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ラフマニノフ' and c.name_original = 'Sergei Rachmaninoff'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('cello', 1::int, false, 0), ('piano', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'フルート・ソナタ', 'Flute Sonata, FP 164', c.id, 1957, '近現代', 'chamber', null
  from composers c where c.name = 'プーランク' and c.name_original = 'Francis Poulenc'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('flute', 1::int, false, 0), ('piano', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '春の海', 'Haru no Umi', c.id, 1929, '近現代', 'chamber', null
  from composers c where c.name = '宮城道雄' and c.name_original = 'Michio Miyagi'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('koto', 1::int, false, 0), ('shakuhachi', 1::int, false, 1)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ケーゲルシュタット・トリオ 変ホ長調', 'Trio in E-flat major, K. 498 "Kegelstatt"', c.id, 1786, '古典派', 'chamber', null
  from composers c where c.name = 'モーツァルト' and c.name_original = 'Wolfgang Amadeus Mozart'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('viola', 1::int, false, 1), ('piano', 1::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ピアノ三重奏曲 第7番 変ロ長調「大公」', 'Piano Trio No. 7, Op. 97 "Archduke"', c.id, 1811, '古典派', 'chamber', null
  from composers c where c.name = 'ベートーヴェン' and c.name_original = 'Ludwig van Beethoven'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, false, 0), ('cello', 1::int, false, 1), ('piano', 1::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ホルン三重奏曲 変ホ長調', 'Horn Trio in E-flat major, Op. 40', c.id, 1865, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ブラームス' and c.name_original = 'Johannes Brahms'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('horn', 1::int, false, 0), ('violin', 1::int, false, 1), ('piano', 1::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '弦楽四重奏曲 第77番 ハ長調「皇帝」', 'String Quartet, Op. 76 No. 3 "Emperor"', c.id, 1797, '古典派', 'chamber', null
  from composers c where c.name = 'ハイドン' and c.name_original = 'Joseph Haydn'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 2::int, false, 0), ('viola', 1::int, false, 1), ('cello', 1::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '弦楽四重奏曲 第12番 ヘ長調「アメリカ」', 'String Quartet No. 12, Op. 96 "American"', c.id, 1893, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ドヴォルザーク' and c.name_original = 'Antonín Dvořák'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 2::int, false, 0), ('viola', 1::int, false, 1), ('cello', 1::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ピアノ四重奏曲 第1番 ト短調', 'Piano Quartet No. 1 in G minor, Op. 25', c.id, 1861, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ブラームス' and c.name_original = 'Johannes Brahms'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, false, 0), ('viola', 1::int, false, 1), ('cello', 1::int, false, 2), ('piano', 1::int, false, 3)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '世の終わりのための四重奏曲', 'Quatuor pour la fin du temps', c.id, 1941, '近現代', 'chamber', null
  from composers c where c.name = 'メシアン' and c.name_original = 'Olivier Messiaen'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('violin', 1::int, false, 1), ('cello', 1::int, false, 2), ('piano', 1::int, false, 3)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'クラリネット五重奏曲 イ長調', 'Clarinet Quintet in A major, K. 581', c.id, 1789, '古典派', 'chamber', null
  from composers c where c.name = 'モーツァルト' and c.name_original = 'Wolfgang Amadeus Mozart'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('violin', 2::int, false, 1), ('viola', 1::int, false, 2), ('cello', 1::int, false, 3)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ピアノ五重奏曲 イ長調「ます」', 'Piano Quintet in A major, D 667 "Trout"', c.id, 1819, 'ロマン派', 'chamber', null
  from composers c where c.name = 'シューベルト' and c.name_original = 'Franz Schubert'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piano', 1::int, false, 0), ('violin', 1::int, false, 1), ('viola', 1::int, false, 2), ('cello', 1::int, false, 3), ('contrabass', 1::int, false, 4)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '弦楽五重奏曲 ハ長調', 'String Quintet in C major, D 956', c.id, 1828, 'ロマン派', 'chamber', null
  from composers c where c.name = 'シューベルト' and c.name_original = 'Franz Schubert'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 2::int, false, 0), ('viola', 1::int, false, 1), ('cello', 2::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ピアノ五重奏曲 第2番 イ長調', 'Piano Quintet No. 2 in A major, Op. 81', c.id, 1887, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ドヴォルザーク' and c.name_original = 'Antonín Dvořák'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piano', 1::int, false, 0), ('violin', 2::int, false, 1), ('viola', 1::int, false, 2), ('cello', 1::int, false, 3)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'クラリネット五重奏曲 ロ短調', 'Clarinet Quintet in B minor, Op. 115', c.id, 1891, 'ロマン派', 'chamber', null
  from composers c where c.name = 'ブラームス' and c.name_original = 'Johannes Brahms'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('violin', 2::int, false, 1), ('viola', 1::int, false, 2), ('cello', 1::int, false, 3)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '小室内音楽', 'Kleine Kammermusik, Op. 24 No. 2', c.id, 1922, '近現代', 'chamber', '木管五重奏'
  from composers c where c.name = 'ヒンデミット' and c.name_original = 'Paul Hindemith'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('flute', 1::int, false, 0), ('oboe', 1::int, false, 1), ('clarinet', 1::int, false, 2), ('horn', 1::int, false, 3), ('bassoon', 1::int, false, 4)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '兵士の物語', 'L''Histoire du soldat', c.id, 1918, '近現代', 'chamber', '語り手・俳優を伴う舞台作品'
  from composers c where c.name = 'ストラヴィンスキー' and c.name_original = 'Igor Stravinsky'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('bassoon', 1::int, false, 1), ('cornet', 1::int, false, 2), ('trombone', 1::int, false, 3), ('violin', 1::int, false, 4), ('contrabass', 1::int, false, 5), ('percussion', 1::int, false, 6)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '弦楽八重奏曲 変ホ長調', 'String Octet in E-flat major, Op. 20', c.id, 1825, 'ロマン派', 'chamber', null
  from composers c where c.name = 'メンデルスゾーン' and c.name_original = 'Felix Mendelssohn'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 4::int, false, 0), ('viola', 2::int, false, 1), ('cello', 2::int, false, 2)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '八重奏曲 ヘ長調', 'Octet in F major, D 803', c.id, 1824, 'ロマン派', 'chamber', null
  from composers c where c.name = 'シューベルト' and c.name_original = 'Franz Schubert'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, false, 0), ('horn', 1::int, false, 1), ('bassoon', 1::int, false, 2), ('violin', 2::int, false, 3), ('viola', 1::int, false, 4), ('cello', 1::int, false, 5), ('contrabass', 1::int, false, 6)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'セレナード 第10番 変ロ長調「グラン・パルティータ」', 'Serenade No. 10, K. 361 "Gran Partita"', c.id, 1781, '古典派', 'chamber', '13管楽器のためのセレナード（作曲年は1781〜84年頃）'
  from composers c where c.name = 'モーツァルト' and c.name_original = 'Wolfgang Amadeus Mozart'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('oboe', 2::int, false, 0), ('clarinet', 2::int, false, 1), ('bassethorn', 2::int, false, 2), ('horn', 4::int, false, 3), ('bassoon', 2::int, false, 4), ('contrabass', 1::int, false, 5)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '協奏曲集「四季」より「春」', 'Le quattro stagioni: La primavera, RV 269', c.id, 1725, 'バロック', 'concerto', '弦楽合奏と通奏低音'
  from composers c where c.name = 'ヴィヴァルディ' and c.name_original = 'Antonio Vivaldi'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, true, 0), ('violin', null::int, false, 1), ('viola', null::int, false, 2), ('cello', null::int, false, 3), ('contrabass', null::int, false, 4), ('harpsichord', null::int, false, 5)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'クラリネット協奏曲 イ長調', 'Clarinet Concerto in A major, K. 622', c.id, 1791, '古典派', 'concerto', null
  from composers c where c.name = 'モーツァルト' and c.name_original = 'Wolfgang Amadeus Mozart'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('clarinet', 1::int, true, 0), ('flute', 2::int, false, 1), ('bassoon', 2::int, false, 2), ('horn', 2::int, false, 3), ('violin', null::int, false, 4), ('viola', null::int, false, 5), ('cello', null::int, false, 6), ('contrabass', null::int, false, 7)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ヴァイオリン協奏曲 ニ長調', 'Violin Concerto in D major, Op. 35', c.id, 1878, 'ロマン派', 'concerto', null
  from composers c where c.name = 'チャイコフスキー' and c.name_original = 'Pyotr Ilyich Tchaikovsky'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', 1::int, true, 0), ('flute', 2::int, false, 1), ('oboe', 2::int, false, 2), ('clarinet', 2::int, false, 3), ('bassoon', 2::int, false, 4), ('horn', 4::int, false, 5), ('trumpet', 2::int, false, 6), ('timpani', null::int, false, 7), ('violin', null::int, false, 8), ('viola', null::int, false, 9), ('cello', null::int, false, 10), ('contrabass', null::int, false, 11)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ピアノ協奏曲 第2番 ハ短調', 'Piano Concerto No. 2 in C minor, Op. 18', c.id, 1901, 'ロマン派', 'concerto', null
  from composers c where c.name = 'ラフマニノフ' and c.name_original = 'Sergei Rachmaninoff'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piano', 1::int, true, 0), ('flute', 2::int, false, 1), ('oboe', 2::int, false, 2), ('clarinet', 2::int, false, 3), ('bassoon', 2::int, false, 4), ('horn', 4::int, false, 5), ('trumpet', 2::int, false, 6), ('trombone', 3::int, false, 7), ('tuba', 1::int, false, 8), ('timpani', null::int, false, 9), ('percussion', null::int, false, 10), ('violin', null::int, false, 11), ('viola', null::int, false, 12), ('cello', null::int, false, 13), ('contrabass', null::int, false, 14)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ノヴェンバー・ステップス', 'November Steps', c.id, 1967, '近現代', 'concerto', null
  from composers c where c.name = '武満徹' and c.name_original = 'Toru Takemitsu'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('biwa', 1::int, true, 0), ('shakuhachi', 1::int, true, 1), ('flute', null::int, false, 2), ('oboe', null::int, false, 3), ('clarinet', null::int, false, 4), ('bassoon', null::int, false, 5), ('horn', null::int, false, 6), ('trumpet', null::int, false, 7), ('trombone', null::int, false, 8), ('percussion', null::int, false, 9), ('harp', null::int, false, 10), ('violin', null::int, false, 11), ('viola', null::int, false, 12), ('cello', null::int, false, 13), ('contrabass', null::int, false, 14)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '交響曲 第5番 ハ短調', 'Symphony No. 5 in C minor, Op. 67', c.id, 1808, '古典派', 'orchestra', null
  from composers c where c.name = 'ベートーヴェン' and c.name_original = 'Ludwig van Beethoven'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piccolo', 1::int, false, 0), ('flute', 2::int, false, 1), ('oboe', 2::int, false, 2), ('clarinet', 2::int, false, 3), ('bassoon', 2::int, false, 4), ('contrabassoon', 1::int, false, 5), ('horn', 2::int, false, 6), ('trumpet', 2::int, false, 7), ('trombone', 3::int, false, 8), ('timpani', null::int, false, 9), ('violin', null::int, false, 10), ('viola', null::int, false, 11), ('cello', null::int, false, 12), ('contrabass', null::int, false, 13)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '交響曲 第9番 ホ短調「新世界より」', 'Symphony No. 9 in E minor, Op. 95 "From the New World"', c.id, 1893, 'ロマン派', 'orchestra', null
  from composers c where c.name = 'ドヴォルザーク' and c.name_original = 'Antonín Dvořák'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('flute', 2::int, false, 0), ('oboe', 2::int, false, 1), ('englishhorn', 1::int, false, 2), ('clarinet', 2::int, false, 3), ('bassoon', 2::int, false, 4), ('horn', 4::int, false, 5), ('trumpet', 2::int, false, 6), ('trombone', 3::int, false, 7), ('tuba', 1::int, false, 8), ('timpani', null::int, false, 9), ('percussion', null::int, false, 10), ('violin', null::int, false, 11), ('viola', null::int, false, 12), ('cello', null::int, false, 13), ('contrabass', null::int, false, 14)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select 'ボレロ', 'Boléro', c.id, 1928, '近現代', 'orchestra', '小太鼓のリズムが全曲を通して続く'
  from composers c where c.name = 'ラヴェル' and c.name_original = 'Maurice Ravel'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piccolo', null::int, false, 0), ('flute', null::int, false, 1), ('oboe', null::int, false, 2), ('englishhorn', null::int, false, 3), ('clarinet', null::int, false, 4), ('bassclarinet', null::int, false, 5), ('bassoon', null::int, false, 6), ('contrabassoon', null::int, false, 7), ('saxophone', null::int, false, 8), ('horn', null::int, false, 9), ('trumpet', null::int, false, 10), ('trombone', null::int, false, 11), ('tuba', null::int, false, 12), ('timpani', null::int, false, 13), ('percussion', null::int, false, 14), ('celesta', null::int, false, 15), ('harp', null::int, false, 16), ('violin', null::int, false, 17), ('viola', null::int, false, 18), ('cello', null::int, false, 19), ('contrabass', null::int, false, 20)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '弦楽のためのアダージョ', 'Adagio for Strings, Op. 11', c.id, 1936, '近現代', 'orchestra', '弦楽合奏。弦楽四重奏曲 第1番の第2楽章を編曲'
  from composers c where c.name = 'バーバー' and c.name_original = 'Samuel Barber'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('violin', null::int, false, 0), ('viola', null::int, false, 1), ('cello', null::int, false, 2), ('contrabass', null::int, false, 3)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

with p as (
  insert into pieces (title, original, composer_id, year, era, setting, note)
  select '吹奏楽のための第1組曲 変ホ長調', 'First Suite in E-flat for Military Band, Op. 28 No. 1', c.id, 1909, '近現代', 'band', null
  from composers c where c.name = 'ホルスト' and c.name_original = 'Gustav Holst'
  returning id
)
insert into piece_instruments (piece_id, instrument_id, count, is_solo, position)
select p.id, i.id, v.count, v.is_solo, v.position
from p, (values ('piccolo', null::int, false, 0), ('flute', null::int, false, 1), ('oboe', null::int, false, 2), ('clarinet', null::int, false, 3), ('bassclarinet', null::int, false, 4), ('bassoon', null::int, false, 5), ('saxophone', null::int, false, 6), ('cornet', null::int, false, 7), ('trumpet', null::int, false, 8), ('horn', null::int, false, 9), ('trombone', null::int, false, 10), ('euphonium', null::int, false, 11), ('tuba', null::int, false, 12), ('contrabass', null::int, false, 13), ('timpani', null::int, false, 14), ('percussion', null::int, false, 15)) as v (key, count, is_solo, position)
join instruments i on i.key = v.key;

commit;
