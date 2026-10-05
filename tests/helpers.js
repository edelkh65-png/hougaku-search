// テストの共通部品
//   ・music/ のファイルを配る小さなサーバー（config.js だけテスト用の接続先に差し替える）
//   ・Supabase のふり（fixtures/db.json のデータで REST と認証に答える）
//   ・ブラウザ（Playwright の Chromium）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MUSIC = path.join(__dirname, '..');
// CSP（connect-src）で許可されている *.supabase.co の形にしておく
const DB_URL = 'https://test.supabase.co';
const EDITOR = { email: 'editor@example.com', password: 'pass1234' };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname === '/music/config.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'] });
      return res.end(`window.MUSIC_DB = { url: '${DB_URL}', key: 'test-key' };`);
    }
    const file = path.join(MUSIC, pathname.replace(/^\/music\//, ''));
    if (!file.startsWith(MUSIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// fixtures/db.json を、Supabase が返す形（埋め込みつきの行）にする
function loadDb() {
  const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'db.json'), 'utf8'));
  db.pieces = db.pieces.map((p) => toPieceRow(db, p));
  return db;
}

function toPieceRow(db, p) {
  const category = db.categories.find((c) => c.id === p.category_id);
  const composer = db.composers.find((c) => c.id === p.composer_id);
  return {
    id: p.id, title: p.title, reading: p.reading || '', subtitle: p.subtitle || '', arranger: p.arranger || '',
    year: p.year === undefined ? null : p.year, year_label: p.year_label || '', remarks: p.remarks || '',
    category_id: p.category_id || null,
    category: category ? { name: category.name, color: category.color } : null,
    composer: composer ? { name: composer.name, reading: composer.reading } : null,
    piece_instruments: (p.instruments || []).map((i, position) => ({
      parts: i.parts === undefined ? null : i.parts, is_solo: !!i.is_solo, is_optional: !!i.is_optional,
      notation: i.notation || '', position, instrument: { key: i.key },
    })),
  };
}

// PostgREST の「列=eq.値」の絞り込みと limit / offset / order=id.desc だけ扱う
function queryRows(rows, params) {
  let out = rows;
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const [op, ...rest] = value.split('.');
    const v = rest.join('.');
    if (op === 'eq') out = out.filter((r) => String(r[key]) === v);
    if (op === 'is') out = out.filter((r) => String(r[key]) === v);
  }
  if (params.get('order') === 'id.desc') out = out.slice().sort((a, b) => b.id - a.id);
  const offset = Number(params.get('offset') || 0);
  const limit = Number(params.get('limit') || 1000);
  return out.slice(offset, offset + limit);
}

// Supabase のふり。page.route で REST と認証の通信に答え、送られた内容を記録する
function mockSupabase(db, options = {}) {
  const log = { addPiece: [], passwords: [], recover: [] };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const params = url.searchParams;
    const authed = Boolean(req.headers().authorization);
    const body = req.postData() ? JSON.parse(req.postData()) : null;

    // ---- 認証 ----
    if (p === '/auth/v1/token') {
      if (params.get('grant_type') === 'password' && !(body.email === EDITOR.email && body.password === EDITOR.password)) {
        return json(route, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      }
      return json(route, { access_token: 'token', refresh_token: 'refresh', expires_in: 3600, user: { email: EDITOR.email } });
    }
    if (p === '/auth/v1/user' && req.method() === 'PUT') {
      log.passwords.push(body.password);
      if (options.weakPassword) return json(route, { error_code: 'weak_password', msg: 'weak' }, 422);
      return json(route, { email: 'new@example.com' });
    }
    if (p === '/auth/v1/user') return json(route, { email: 'new@example.com' });
    if (p === '/auth/v1/recover') { log.recover.push(body.email); return json(route, {}); }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204 });

    // ---- データ ----
    const table = p.replace('/rest/v1/', '');
    if (table === 'rpc/add_piece') {
      log.addPiece.push(body.piece);
      const id = Math.max(...db.pieces.map((r) => r.id)) + 1;
      const category = db.categories.find((c) => c.name === body.piece.category);
      db.pieces.push(toPieceRow(db, { id, title: body.piece.title, reading: body.piece.reading, category_id: category && category.id, instruments: body.piece.instruments }));
      return json(route, id);
    }
    if (table === 'editors') return json(route, authed ? [{ user_id: 'editor' }] : []);
    if (table === 'instruments') return json(route, queryRows(db.instruments, params));
    if (table === 'composers') return json(route, queryRows(db.composers, params));
    if (table === 'categories') {
      const rows = db.categories.map((c) => ({ ...c, hidden: String(c.hidden) }));
      return json(route, queryRows(rows, params).map((c) => ({ ...c, hidden: c.hidden === 'true' })));
    }
    if (table === 'pieces') {
      // 非表示の分類の曲は、ログインしていないと読めない（本番の Row Level Security と同じ）
      const hidden = new Set(db.categories.filter((c) => c.hidden).map((c) => c.id));
      const visible = authed ? db.pieces : db.pieces.filter((r) => !hidden.has(r.category_id));
      if (req.method() === 'DELETE') {
        const id = Number(params.get('id').replace('eq.', ''));
        const removed = db.pieces.filter((r) => r.id === id);
        db.pieces = db.pieces.filter((r) => r.id !== id);
        return json(route, removed);
      }
      let rows = queryRows(visible, params);
      // 登録ページの「最近登録した曲」は楽器の件数だけを読む
      if ((params.get('select') || '').includes('piece_instruments(count)')) {
        rows = rows.map((r) => ({ ...r, piece_instruments: [{ count: r.piece_instruments.length }] }));
      }
      return json(route, rows);
    }
    return json(route, { message: `テスト用の Supabase が知らない通信です：${p}` }, 404);
  }

  return { handle, log };
}

// テスト1ファイル分の準備：サーバー・ブラウザ・ページを作る関数を返す
async function setup() {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/music/`;
  const browser = await chromium.launch();

  async function newPage({ viewport = { width: 1000, height: 900 }, mockOptions } = {}) {
    const db = loadDb();
    const supabase = mockSupabase(db, mockOptions);
    const context = await browser.newContext({ viewport });
    await context.route(`${DB_URL}/**`, supabase.handle);
    // Google Fonts は読み込まない（ネットワークに出ないように）
    await context.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    return { page, db, log: supabase.log, errors };
  }

  async function close() {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  return { base, newPage, close };
}

module.exports = { setup, loadDb, EDITOR, MUSIC };
