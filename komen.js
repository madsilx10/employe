const fs = require('fs');
const readline = require('readline');

const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I7wHoZeT%2FIs1%2FfDv3FMw%3D';
const TWEET_ID = '2083837792615100459';
const FOLLOW_TARGET = 'expumpemployee';
const DONE_FILE = 'done.json';
const FOLLOWED_FILE = 'followed.json';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function loadAccounts() {
  const lines = fs.readFileSync('akun.txt', 'utf8')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const accounts = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    accounts.push({ auth_token: lines[i], ct0: lines[i + 1] });
  }
  return accounts;
}

function loadComments() {
  return fs.readFileSync('komen.txt', 'utf8')
    .split('\n').map(l => l.trim()).filter(Boolean);
}

function loadDone() {
  if (fs.existsSync(DONE_FILE)) return JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'));
  return {};
}

function saveDone(done) {
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
}

function loadFollowed() {
  if (fs.existsSync(FOLLOWED_FILE)) return JSON.parse(fs.readFileSync(FOLLOWED_FILE, 'utf8'));
  return {};
}

function saveFollowed(followed) {
  fs.writeFileSync(FOLLOWED_FILE, JSON.stringify(followed, null, 2));
}

function doneKey(account) {
  return account.auth_token.slice(0, 16);
}

function baseHeaders(auth_token, ct0, contentType = 'application/json') {
  return {
    'authorization': `Bearer ${BEARER}`,
    'cookie': `auth_token=${auth_token}; ct0=${ct0}`,
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
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  };
}

async function followUser(auth_token, ct0) {
  const res = await fetch('https://api.twitter.com/1.1/friendships/create.json', {
    method: 'POST',
    headers: baseHeaders(auth_token, ct0, 'application/x-www-form-urlencoded'),
    body: `screen_name=${FOLLOW_TARGET}&include_entities=false&skip_status=true`
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function postComment(auth_token, ct0, comment) {
  const variables = {
    tweet_text: comment,
    reply: {
      in_reply_to_tweet_id: TWEET_ID,
      exclude_reply_user_ids: []
    },
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

  const res = await fetch('https://twitter.com/i/api/graphql/SoVnbfCycZ7fERGCwpZkYA/CreateTweet', {
    method: 'POST',
    headers: baseHeaders(auth_token, ct0),
    body: JSON.stringify({ variables, features })
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function processAccount(account, comment, idx, done, followed) {
  const key = doneKey(account);

  if (done[key]) {
    console.log(`[${idx}] ⏭  Skip — sudah komen sebelumnya`);
    return;
  }

  // FOLLOW
  if (followed[key]) {
    console.log(`[${idx}] ⏭  Follow skip — sudah follow sebelumnya`);
  } else {
    console.log(`[${idx}] 🔁 Follow @${FOLLOW_TARGET}...`);
    try {
      const r = await followUser(account.auth_token, account.ct0);
      if (r.ok) {
        console.log(`[${idx}] ✅ Follow OK`);
        followed[key] = { timestamp: new Date().toISOString() };
        saveFollowed(followed);
      } else {
        console.log(`[${idx}] ⚠  Follow status ${r.status} — lanjut komen anyway`);
      }
    } catch (e) {
      console.log(`[${idx}] ❌ Follow error: ${e.message}`);
    }
  }

  const jeda1 = rand(2000, 10000);
  console.log(`[${idx}] ⏳ Jeda ${(jeda1 / 1000).toFixed(1)}s sebelum komen...`);
  await sleep(jeda1);

  // COMMENT
  console.log(`[${idx}] 💬 Komen: "${comment}"`);
  try {
    const r = await postComment(account.auth_token, account.ct0, comment);
    if (r.ok && r.data?.data?.create_tweet) {
      const tweetId = r.data.data.create_tweet.tweet_results?.result?.rest_id;
      console.log(`[${idx}] ✅ Komen OK${tweetId ? ` — ID: ${tweetId}` : ''}`);
      done[key] = { comment, timestamp: new Date().toISOString() };
      saveDone(done);
    } else {
      const errMsg = JSON.stringify(r.data?.errors || r.data).slice(0, 200);
      console.log(`[${idx}] ⚠  Komen gagal (${r.status}): ${errMsg}`);
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

  console.log(`\n📋 Akun terbaca  : ${accounts.length}`);
  console.log(`💬 Komentar tersedia: ${comments.length}`);
  console.log(`✔  Sudah done    : ${Object.keys(done).length}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('Pilih mode:');
  console.log('  1. 1 akun saja');
  console.log('  2. Semua akun');
  console.log('  3. From X to end');

  const pilihan = (await ask('\nPilih (1/2/3): ')).trim();

  let start = 0;
  let end = accounts.length - 1;

  if (pilihan === '1') {
    const idx = await ask(`Akun ke- (1-${accounts.length}): `);
    start = parseInt(idx) - 1;
    end = start;
  } else if (pilihan === '3') {
    const from = await ask(`Dari akun ke- (1-${accounts.length}): `);
    start = parseInt(from) - 1;
  }

  rl.close();

  if (start < 0 || start >= accounts.length) {
    console.log('❌ Nomor akun tidak valid');
    process.exit(1);
  }

  console.log(`\n🚀 Proses akun ${start + 1} s/d ${end + 1}\n`);

  for (let i = start; i <= end; i++) {
    const comment = comments[i]; // akun ke-i pakai komen ke-i (1:1)
    if (!comment) {
      console.log(`[${i + 1}] ⚠  Tidak ada komen untuk akun ini (komen.txt kurang), skip`);
      continue;
    }
    await processAccount(accounts[i], comment, i + 1, done, followed);

    if (i < end) {
      const jeda2 = rand(5000, 35000);
      console.log(`⏳ Jeda ${(jeda2 / 1000).toFixed(1)}s sebelum akun berikutnya...\n`);
      await sleep(jeda2);
    }
  }

  console.log('\n✅ Semua selesai!');
}

main().catch(console.error);
