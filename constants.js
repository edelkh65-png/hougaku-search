// 楽器の分類（検索画面での見出しと並び順）。open: true のジャンルは最初から開いておく
const FAMILIES = [
  { key: 'koto',       label: '箏・多絃箏', open: true },
  { key: 'shamisen',   label: '三絃・琵琶・胡弓', open: true },
  { key: 'kan',        label: '尺八・笛・笙', open: true },
  { key: 'percussion', label: '打楽器' },
  { key: 'voice',      label: '歌・合唱・語り' },
  { key: 'western',    label: '洋楽器' },
  { key: 'other',      label: 'その他' },
];

// 一度に表示する曲数の選択肢と初期値
const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
