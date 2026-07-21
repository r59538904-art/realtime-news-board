// Yahoo Finance CORSプロキシ(Cloudflare Worker)。
// このファイルはGitHub Pagesにはデプロイされない。Cloudflare Workers(無料枠)へ
// 別途デプロイして使う中継サーバーのソース。デプロイ手順はREADME
// 「株価現在値カード(Cloudflare Workerプロキシ)のセットアップ」を参照。
//
// 何のためにあるか:
//   Yahoo Finance(query1.finance.yahoo.com)はAccess-Control-Allow-Originヘッダーを
//   返さないため、ブラウザから直接fetch()できない(実機確認済み)。この Worker が
//   ブラウザとYahoo Financeの間に立ち、(1) Yahoo側が要求するUser-Agentを付けて
//   代理リクエストし、(2) レスポンスに watchlist.js 側のオリジンを許可する
//   Access-Control-Allow-Origin を付けて返す、という2つの役割だけを持つ。
//   watchlist.jsのビジネスロジック(検索結果の整形・現在値カードの描画等)は
//   一切ここに置かない(単なる中継に徹する)。
//
// 提供するエンドポイント:
//   GET /search?q=キーワード   … 銘柄検索(Yahoo Finance search APIの代理)
//   GET /quote?symbol=シンボル … 現在値・値幅(Yahoo Finance chart APIの代理)

// デプロイ後のWorker URLをwatchlist.js側のWL_PROXY_BASE_URLに設定する。
// ここではセキュリティのため、そのURL(=あなたのGitHub PagesのURL)からのアクセスだけ許可する。
const ALLOWED_ORIGIN = 'https://r59538904-art.github.io';

const YAHOO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CACHE_SECONDS = 30; // Yahoo側への負荷軽減と応答速度向上のため、同一リクエストを短時間キャッシュする

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// 銘柄コードは英数字・ドット・ハイフン・^・=のみ(例: 9432.T, ^N225, JPY=X)を許可し、
// それ以外は拒否する。任意のURLを中継させられる「オープンプロキシ」化を防ぐための入力検証
function isValidSymbol(value) {
  return typeof value === 'string' && /^[A-Za-z0-9.\-^=]{1,15}$/.test(value);
}
// 検索キーワードは長さと文字種だけ緩く制限する(会社名は日本語等も想定しているため
// 銘柄コードほど厳しくはしないが、上限を設けて極端に長いリクエストは弾く)
function isValidQuery(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 50;
}

async function proxyToYahoo(upstreamUrl, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    Object.entries(corsHeaders()).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: { 'User-Agent': YAHOO_USER_AGENT, Accept: 'application/json' },
  });
  const bodyText = await upstreamResponse.text();
  const response = new Response(bodyText, {
    status: upstreamResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      ...corsHeaders(),
    },
  });
  if (upstreamResponse.ok) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'method not allowed' }, 405);
    }

    if (url.pathname === '/quote') {
      const symbol = url.searchParams.get('symbol') || '';
      if (!isValidSymbol(symbol)) return jsonResponse({ error: 'invalid symbol' }, 400);
      const upstreamUrl =
        'https://query1.finance.yahoo.com/v8/finance/chart/' +
        encodeURIComponent(symbol) +
        '?interval=1d&range=5d';
      return proxyToYahoo(upstreamUrl, ctx);
    }

    if (url.pathname === '/search') {
      const query = url.searchParams.get('q') || '';
      if (!isValidQuery(query)) return jsonResponse({ error: 'invalid query' }, 400);
      const upstreamUrl =
        'https://query1.finance.yahoo.com/v1/finance/search?q=' +
        encodeURIComponent(query) +
        '&quotesCount=8&newsCount=0';
      return proxyToYahoo(upstreamUrl, ctx);
    }

    return jsonResponse({ error: 'not found' }, 404);
  },
};
