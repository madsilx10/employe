import json, time, random, os, sys
import requests

BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
TWEET_ID = '2083837792615100459'
FOLLOW_TARGET = 'expumpemployee'
FOLLOW_QUERY_ID = 'lKj0-madKJiNbpFgMNHerQ'
DONE_FILE = 'done.json'
FOLLOWED_FILE = 'followed.json'

def sleep(min_s, max_s):
    t = random.uniform(min_s, max_s)
    print(f'⏳ Jeda {t:.1f}s...')
    time.sleep(t)

def load_accounts():
    with open('akun.txt', encoding='utf-8-sig') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]
    accounts = []
    for i in range(0, len(lines) - 1, 2):
        accounts.append({'auth_token': lines[i], 'ct0': lines[i+1]})
    return accounts

def load_comments():
    with open('komen.txt', encoding='utf-8-sig') as f:
        return [l.strip() for l in f.readlines() if l.strip()]

def load_json(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def done_key(account):
    return account['auth_token'][:16]

def make_session(auth_token, ct0):
    s = requests.Session()
    s.headers.update({
        'authorization': f'Bearer {BEARER}',
        'x-csrf-token': ct0,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        'origin': 'https://x.com',
        'referer': 'https://x.com/',
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
    })
    s.cookies.set('auth_token', auth_token, domain='.x.com')
    s.cookies.set('ct0', ct0, domain='.x.com')
    return s

def get_user_id(session):
    r = session.get(f'https://x.com/i/api/1.1/users/show.json?screen_name={FOLLOW_TARGET}')
    if r.ok:
        return r.json().get('id_str')
    print(f'  [getUserId] {r.status_code}: {r.text[:100]}')
    return None

def follow_user(session):
    r = session.post(
        'https://x.com/i/api/1.1/friendships/create.json',
        data={'screen_name': FOLLOW_TARGET, 'include_entities': 'false', 'skip_status': 'true'},
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    return r.ok, r.text[:150]

def post_comment(session, comment):
    variables = {
        'tweet_text': comment,
        'reply': {'in_reply_to_tweet_id': TWEET_ID, 'exclude_reply_user_ids': []},
        'dark_request': False,
        'media': {'media_entities': [], 'possibly_sensitive': False},
        'semantic_annotation_ids': []
    }
    features = {
        'tweetypie_unmention_optimization_enabled': True,
        'responsive_web_edit_tweet_api_enabled': True,
        'graphql_is_translatable_rweb_tweet_is_translatable_enabled': True,
        'view_counts_everywhere_api_enabled': True,
        'longform_notetweets_consumption_enabled': True,
        'responsive_web_twitter_article_tweet_consumption_enabled': False,
        'tweet_awards_web_tipping_enabled': False,
        'longform_notetweets_rich_text_read_enabled': True,
        'longform_notetweets_inline_media_enabled': True,
        'responsive_web_graphql_exclude_directive_enabled': True,
        'verified_phone_label_enabled': False,
        'freedom_of_speech_not_reach_fetch_enabled': True,
        'standardized_nudges_misinfo': True,
        'tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled': True,
        'responsive_web_graphql_skip_user_profile_image_extensions_enabled': False,
        'responsive_web_graphql_timeline_navigation_enabled': True,
        'interactive_text_enabled': True,
        'responsive_web_text_conversations_enabled': False,
        'responsive_web_enhance_cards_enabled': False,
    }
    r = session.post(
        'https://x.com/i/api/graphql/SoVnbfCycZ7fERGCwpZkYA/CreateTweet',
        json={'variables': variables, 'features': features, 'queryId': 'SoVnbfCycZ7fERGCwpZkYA'}
    )
    if r.ok:
        data = r.json()
        tweet_id = data.get('data', {}).get('create_tweet', {}).get('tweet_results', {}).get('result', {}).get('rest_id')
        return True, tweet_id
    return False, r.text[:200]

def process_account(account, comment, idx, done, followed, skip_follow=False):
    key = done_key(account)

    if key in done:
        print(f'[{idx}] ⏭  Skip — sudah komen')
        return

    session = make_session(account['auth_token'], account['ct0'])

    # FOLLOW
    if skip_follow:
        pass
    elif key in followed:
        print(f'[{idx}] ⏭  Follow skip — sudah follow')
    else:
        print(f'[{idx}] 🔁 Follow @{FOLLOW_TARGET}...')
        ok, msg = follow_user(session)
        if ok:
            print(f'[{idx}] ✅ Follow OK')
            followed[key] = {'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')}
            save_json(FOLLOWED_FILE, followed)
        else:
            print(f'[{idx}] ⚠  Follow gagal: {msg}')

    if not skip_follow:
        sleep(2, 10)

    # COMMENT
    print(f'[{idx}] 💬 Komen: "{comment}"')
    ok, result = post_comment(session, comment)
    if ok:
        print(f'[{idx}] ✅ Komen OK{f" — ID: {result}" if result else ""}')
        done[key] = {'comment': comment, 'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')}
        save_json(DONE_FILE, done)
    else:
        print(f'[{idx}] ⚠  Komen gagal: {result}')

def main():
    accounts = load_accounts()
    comments = load_comments()
    done = load_json(DONE_FILE)
    followed = load_json(FOLLOWED_FILE)

    print(f'\n📋 Akun     : {len(accounts)}')
    print(f'💬 Komentar : {len(comments)}')
    print(f'✔  Done     : {len(done)}\n')

    print('Pilih mode:')
    print('  1. 1 akun saja')
    print('  2. Semua akun')
    print('  3. From X to end')
    pilihan = input('\nPilih (1/2/3): ').strip()

    start, end = 0, len(accounts) - 1

    if pilihan == '1':
        idx = int(input(f'Akun ke- (1-{len(accounts)}): ')) - 1
        start = end = idx
    elif pilihan == '3':
        start = int(input(f'Dari akun ke- (1-{len(accounts)}): ')) - 1

    if not (0 <= start < len(accounts)):
        print('❌ Nomor akun tidak valid')
        sys.exit(1)

    print('Mode aksi:')
    print('  1. Follow + Komen')
    print('  2. Komen doang')
    aksi = input('\nPilih (1/2): ').strip()
    skip_follow = aksi == '2'

    print(f'\n🚀 Proses akun {start+1} s/d {end+1}{" (komen doang)" if skip_follow else ""}\n')

    for i in range(start, end + 1):
        if i >= len(comments):
            print(f'[{i+1}] ⚠  Komen ke-{i+1} tidak ada, skip')
            continue
        process_account(accounts[i], comments[i], i+1, done, followed, skip_follow)
        if i < end:
            sleep(5, 35)

    print('\n✅ Selesai!')

if __name__ == '__main__':
    main()
