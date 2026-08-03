const fs = require('fs');
const readline = require('readline');
const tlsClient = require('tls-client');

const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const TWEET_ID = '2083837792615100459';
const FOLLOW_TARGET = 'expumpemployee';
const FOLLOW_QUERY_ID = 'lKj0-madKJiNbpFgMNHerQ';
const DONE_FILE = 'done.json';
const FOLLOWED_FILE = 'followed.json';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function extractCt0(cookieStr) {
  const m = cookieStr.match(/(?:^|;\s*)ct0=([^;]+)/);
  return m ? m[1].trim() : null;
}

function loadAccounts() {
  return fs.readFileSync('akun.txt', 'utf8')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map(l => l.replace(/\r/g, '').trim())
    .filter(Boolean)
    .map((cookieStr, i) => {
      const ct0 = extractCt0(cookieStr);
      if (!ct0) console.warn(`[WARN] Akun ${i+1}: ct0 tidak ditemukan`);
      return { cookieStr, ct0: ct0 || '' };
    });
}

function loadComments() {
  return fs.readFileSync('komen.txt', 'utf8')
    .replace(/^\uFEFF/, '')
    .split('\n').map(l => l.replace(/\r/g, '').trim()).filter(Boolean);
}

function loadDone() {
  if (fs.existsSync(DONE_FILE)) return JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'));
  return {};
}
function saveDone(done) { fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2)); }

function loadFollowed() {
  if (fs.existsSync(FOLLOWED_FILE)) return JSON.parse(fs.readFileSync(FOLLOWED_FILE, 'utf8'));
  return {};
}
function saveFollowed(f) { fs.writeFileSync(FOLLOWED_FILE, JSON.stringify(f, null, 2)); }

function doneKey(account) { return account.cookieStr.slice(0, 20); }

function makeSession() {
  return new tlsClient.Session({ tlsClientIdentifier: 'chrome_124' });
}

function baseHeaders(cookieStr, ct0, contentType = 'application/json') {
  return {
    'authorization': `Bearer ${BEARER}`,
    'cookie': cookieStr,
    'x-csrf-token': ct0,
    'content-type': contentType,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'origin': 'https://x.com',
    'referer': 'https://x.com/',
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
  };
}

async function getUserId(account) {
  const session = makeSession();
  const res = await session.get(
    `https://x.com/i/api/1.1/users/show.json?screen_name=${FOLLOW_TARGET}`,
    { headers: baseHeaders(account.cookieStr, account.ct0) }
  );
  const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  return data?.id_str || null;
}

async function followUser(account) {
  const userId = await getUserId(account);
  if (!userId) return { ok: false, status: 0, data: { error: 'user id not found' } };

  const session = makeSession();
  const res = await session.post(
    `https://x.com/i/api/graphql/${FOLLOW_QUERY_ID}/FollowUser`,
    {
      headers: baseHeaders(account.cookieStr, account.ct0),
      body: JSON.stringify({ variables: { userId }, queryId: FOLLOW_QUERY_ID })
    }
  );
  const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  return { ok: res.status >= 200 && res.status < 300, status: res.status, data };
}

async function postComment(account, comment) {
  const variables = {
    tweet_text: comment,
    reply: { in_reply_to_tweet_id: TWEET_ID, exclude_reply_user_ids: [] },
    dark_request: false,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: []
  };
  const features = {
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_awards_web_tipping_enabled: false,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    interactive_text_enabled: true,
    responsive_web_text_conversations_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };

  const session = makeSession();
  const res = await session.post(
    'https://x.com/i/api/graphql/wUgPBh9hEKhMMGIg8uDuFw/CreateTweet',
    {
      headers: baseHeaders(account.cookieStr, account.ct0),
      body: JSON.stringify({ variables, features })
    }
  );
  const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  return { ok: res.status >= 200 && res.status < 300, status: res.status, data };
}

async function processAccount(account, comment, idx, done, followed) {
  const key = doneKey(account);

  if (done[key]) {
    console.log(`[${idx}] ⏭  Skip — sudah komen`);
    return;
  }

  if (followed[key]) {
    console.log(`[${idx}] ⏭  Follow skip — sudah follow`);
  } else {
    console.log(`[${idx}] 🔁 Follow @${FOLLOW_TARGET}...`);
    try {
      const r = await followUser(account);
      if (r.ok) {
        console.log(`[${idx}] ✅ Follow OK`);
        followed[key] = { timestamp: new Date().toISOString() };
        saveFollowed(followed);
      } else {
        console.log(`[${idx}] ⚠  Follow gagal (${r.status}): ${JSON.stringify(r.data?.errors || r.data).slice(0, 150)}`);
      }
    } catch (e) {
      console.log(`[${idx}] ❌ Follow error: ${e.message}`);
    }
  }

  const jeda1 = rand(2000, 10000);
  console.log(`[${idx}] ⏳ Jeda ${(jeda1/1000).toFixed(1)}s sebelum komen...`);
  await sleep(jeda1);

  console.log(`[${idx}] 💬 Komen: "${comment}"`);
  try {
    const r = await postComment(account, comment);
    if (r.ok && r.data?.data?.create_tweet) {
      const tweetId = r.data.data.create_tweet.tweet_results?.result?.rest_id;
      console.log(`[${idx}] ✅ Komen OK${tweetId ? ` — ID: ${tweetId}` : ''}`);
      done[key] = { comment, timestamp: new Date().toISOString() };
      saveDone(done);
    } else {
      console.log(`[${idx}] ⚠  Komen gagal (${r.status}): ${JSON.stringify(r.data?.errors || r.data).slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`[${idx}] ❌ Komen error: ${e.message}`);
  }
}

async function main() {
  const accounts = loadAccounts();
  const comments = loadComments();
  const done = loadDone();
  const followed = loadFollowed();

  console.log(`\n📋 Akun      : ${accounts.length}`);
  console.log(`💬 Komentar  : ${comments.length}`);
  console.log(`✔  Done      : ${Object.keys(done).length}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('Pilih mode:');
  console.log('  1. 1 akun saja');
  console.log('  2. Semua akun');
  console.log('  3. From X to end');

  const pilihan = (await ask('\nPilih (1/2/3): ')).trim();
  let start = 0, end = accounts.length - 1;

  if (pilihan === '1') {
    const idx = await ask(`Akun ke- (1-${accounts.length}): `);
    start = parseInt(idx) - 1; end = start;
  } else if (pilihan === '3') {
    const from = await ask(`Dari akun ke- (1-${accounts.length}): `);
    start = parseInt(from) - 1;
  }
  rl.close();

  if (start < 0 || start >= accounts.length) { console.log('❌ Nomor akun tidak valid'); process.exit(1); }

  console.log(`\n🚀 Proses akun ${start+1} s/d ${end+1}\n`);

  for (let i = start; i <= end; i++) {
    const comment = comments[i];
    if (!comment) { console.log(`[${i+1}] ⚠  Komen ke-${i+1} tidak ada, skip`); continue; }
    await processAccount(accounts[i], comment, i+1, done, followed);
    if (i < end) {
      const jeda2 = rand(5000, 35000);
      console.log(`⏳ Jeda ${(jeda2/1000).toFixed(1)}s...\n`);
      await sleep(jeda2);
    }
  }
  console.log('\n✅ Selesai!');
}

main().catch(console.error);
