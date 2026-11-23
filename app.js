/* AI-versiti Community — app logic (Supabase) */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2600); };
const show = id => ['authView','nameView','appView'].forEach(v => $('#'+v).hidden = v !== id);

const C = window.CONFIG || {};
if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('YOUR-PROJECT')) {
  document.body.innerHTML = '<div style="padding:40px;font:16px Inter,sans-serif">Setup needed: open <b>config.js</b> and paste your Supabase URL and anon key.</div>';
  return;
}
const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
if (C.GOOGLE_LOGIN === false) { $('#googleBtn').hidden = true; $('#orLine').hidden = true; }

let me = null, meEmail = '', isHost = false;
let sessions = [], questions = [], votes = [], profiles = {};
let open = null, filter = 'all', channel = null, started = false;

/* ---------------- helpers ---------------- */
const nm = id => profiles[id]?.name || 'Member';
const ini = id => nm(id).split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };
const fmtD = iso => new Date(iso).toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short', year:'numeric'});
const fmtT = iso => new Date(iso).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
const votesOf = qid => votes.filter(v => v.question_id === qid);
const qOf = sid => questions.filter(q => q.session_id === sid)
  .sort((a, b) => (a.answered - b.answered) || (votesOf(b.id).length - votesOf(a.id).length) || (new Date(a.created_at) - new Date(b.created_at)));
const statusOf = s => s.status === 'live' ? '<span class="tag live">LIVE NOW</span>' : s.status === 'ended' ? '<span class="tag end">ENDED</span>' : '<span class="tag">UPCOMING</span>';
const safeUrl = u => /^https:\/\//i.test(u || '') ? u : '';
async function run(p, okMsg) { const { error } = await p; if (error) { toast(error.message.includes('row-level') ? 'Not allowed' : 'Error: ' + error.message); return false; } if (okMsg) toast(okMsg); return true; }

/* ---------------- auth ---------------- */
$('#googleBtn').onclick = async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } });
  if (error) authMsg(error.message, true);
};
$('#emailForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true;
  const { error } = await sb.auth.signInWithOtp({ email: $('#email').value.trim(), options: { emailRedirectTo: location.origin } });
  btn.disabled = false;
  authMsg(error ? error.message : 'Check your inbox — we sent you a sign-in link. (Look in spam too.)', !!error);
};
function authMsg(t, err) { const m = $('#authMsg'); m.hidden = false; m.textContent = t; m.classList.toggle('err', !!err); }

$('#nameForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#nameIn').value.trim(); if (name.length < 2) return;
  if (await run(sb.from('profiles').update({ name }).eq('id', me))) { profiles[me] = { ...(profiles[me] || {}), name }; enterApp(); }
};

async function onSession(session) {
  if (!session) { me = null; started = false; if (channel) { sb.removeChannel(channel); channel = null; } show('authView'); return; }
  if (started && me === session.user.id) return;
  me = session.user.id; meEmail = session.user.email || '';
  let { data: p } = await sb.from('profiles').select('id,name,is_host').eq('id', me).maybeSingle();
  if (!p) { await new Promise(r => setTimeout(r, 800)); ({ data: p } = await sb.from('profiles').select('id,name,is_host').eq('id', me).maybeSingle()); }
  isHost = !!p?.is_host; profiles[me] = p || { name: '' };
  if (!p?.name || p.name.trim().length < 2) {
    $('#nameIn').value = session.user.user_metadata?.full_name || ''; show('nameView'); return;
  }
  enterApp();
}
function enterApp() {
  if (started) { render(); show('appView'); return; }
  started = true; show('appView');
  if (location.hash.startsWith('#access_token')) history.replaceState(null, '', location.pathname + '#feed');
  $('#mode').textContent = isHost
    ? 'You are the host. Announce sessions, go live with your Zoom link, and mark questions as answered.'
    : 'Post your questions before each live class and upvote the ones you want answered first.';
  load(); subscribe();
}
sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => onSession(session), 0); });

/* ---------------- data ---------------- */
let loadTimer = null;
const reload = () => { clearTimeout(loadTimer); loadTimer = setTimeout(load, 250); };
async function load() {
  const [s, q, v, p] = await Promise.all([
    sb.from('sessions').select('*'),
    sb.from('questions').select('*'),
    sb.from('votes').select('question_id,user_id'),
    sb.from('profiles').select('id,name,is_host')
  ]);
  if (s.error || q.error) { $('#main').innerHTML = '<div class="card empty">Could not load the community. Check your connection and refresh.</div>'; return; }
  sessions = s.data; questions = q.data; votes = v.data || [];
  profiles = Object.fromEntries((p.data || []).map(x => [x.id, x]));
  isHost = !!profiles[me]?.is_host;
  render();
}
function subscribe() {
  channel = sb.channel('community')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, reload)
    .subscribe();
}

/* ---------------- views ---------------- */
function composer() {
  if (!isHost) return '';
  return `<details class="card compose"><summary>Announce a live session</summary>
  <form id="newS">
    <label for="fT">Session title</label><input id="fT" required minlength="3" maxlength="120" placeholder="e.g. Ask me anything: YouTube Automation">
    <div class="row"><div><label for="fD">Date and time</label><input id="fD" type="datetime-local" required></div>
    <div><label for="fZ">Zoom link (optional — add later)</label><input id="fZ" type="url" placeholder="https://zoom.us/j/…"></div></div>
    <label for="fX">Message to members</label><textarea id="fX" maxlength="800">Post your questions below. I'll answer the most upvoted ones live.</textarea>
    <div class="acts" style="border:0;padding:0"><button class="pri">Post announcement</button></div>
  </form></details>`;
}
function sessionCard(s, full) {
  const qs = qOf(s.id), url = safeUrl(s.zoom_url);
  const zoom = url ? `<div class="zoom"><a class="pri" href="${esc(url)}" target="_blank" rel="noopener">${s.status === 'live' ? 'Join live on Zoom' : 'Zoom link'}</a><code>${esc(url)}</code></div>`
    : (s.status !== 'ended' ? `<div class="mut">The Zoom link will appear here when the session goes live.</div>` : '');
  const hostActs = isHost ? `
    ${s.status === 'upcoming' ? `<button data-a="golive" data-id="${s.id}">Go live + share Zoom</button>` : ''}
    ${s.status === 'live' ? `<button data-a="end" data-id="${s.id}">End session</button><button data-a="zoom" data-id="${s.id}">Change Zoom link</button>` : ''}
    <button class="ghost" data-a="delS" data-id="${s.id}">Delete</button>` : '';
  return `<article class="card post">
    <div class="top"><div class="av">${ini(s.created_by)}</div><div style="flex:1"><b>${esc(nm(s.created_by))}</b><div class="mut">${ago(s.created_at)} · Live session announcement</div></div>${statusOf(s)}</div>
    <h3>${esc(s.title)}</h3>
    <div class="when"><span><small>DATE</small><b>${fmtD(s.starts_at)}</b></span><span><small>TIME</small><b>${fmtT(s.starts_at)}</b></span></div>
    ${s.description ? `<p style="margin:6px 0;white-space:pre-wrap">${esc(s.description)}</p>` : ''}
    ${zoom}
    ${full ? questionsBlock(s, qs) : `<div class="acts"><button class="pri" data-a="open" data-id="${s.id}">${s.status === 'ended' ? 'View questions' : 'Ask a question'}</button><span class="mut" style="align-self:center">${qs.length} question${qs.length === 1 ? '' : 's'}</span>${hostActs}</div>`}
    ${full && isHost ? `<div class="acts">${hostActs}</div>` : ''}
  </article>`;
}
function questionsBlock(s, qs) {
  const form = s.status === 'ended' ? '<p class="mut">This session has ended. Questions are closed.</p>'
    : `<form id="newQ" data-sid="${s.id}" style="margin:14px 0"><label for="fQ">Your question for this live session</label><textarea id="fQ" required minlength="3" maxlength="600" placeholder="Be specific — the host answers the most upvoted questions first."></textarea><div style="margin-top:10px"><button class="pri">Post question</button></div></form>`;
  return `<div style="margin-top:12px">${form}
   <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><h3 style="font-size:17px">Questions (${qs.length})</h3><span class="mut">Most upvoted first</span></div>
   ${qs.map(qRow).join('') || '<p class="mut">No questions yet. Be the first to ask.</p>'}</div>`;
}
function qRow(q) {
  const mine = q.author_id === me, vs = votesOf(q.id), voted = vs.some(v => v.user_id === me);
  return `<div class="q"><button class="vote ${voted ? 'on' : ''}" data-a="vote" data-id="${q.id}" aria-label="Upvote">▲<small>${vs.length}</small></button>
   <div><p>${esc(q.body)}</p><div class="mut">${esc(nm(q.author_id))} · ${ago(q.created_at)} ${q.answered ? '· <span class="done">Answered live</span>' : ''}</div>
   ${(isHost || mine) ? `<div style="display:flex;gap:4px;margin-top:4px">${isHost ? `<button class="ghost" data-a="ans" data-id="${q.id}">${q.answered ? 'Mark unanswered' : 'Mark answered'}</button>` : ''}<button class="ghost" data-a="delQ" data-id="${q.id}">Delete</button></div>` : ''}</div></div>`;
}
function render() {
  const v = location.hash.slice(1) || 'feed';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  const rank = { live: 0, upcoming: 1, ended: 2 };
  const sorted = [...sessions].sort((a, b) => (rank[a.status] - rank[b.status]) ||
    (a.status === 'ended' ? new Date(b.starts_at) - new Date(a.starts_at) : new Date(a.starts_at) - new Date(b.starts_at)));
  let html = '';
  if (open) {
    const s = sessions.find(x => x.id === open);
    html = s ? `<button class="back" data-a="close">← Back to feed</button>${sessionCard(s, true)}` : '<div class="card empty">This session was removed.</div>';
  } else if (v === 'my-questions') {
    const mine = questions.filter(q => q.author_id === me).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    html = `<h2>My questions</h2>` + (mine.length ? mine.map(q => { const s = sessions.find(x => x.id === q.session_id);
      return `<div class="card">${qRow(q)}<div class="mut">For: ${s ? `<a href="#" data-a="open" data-id="${s.id}">${esc(s.title)}</a>` : 'a removed session'}</div></div>`; }).join('')
      : '<div class="card empty">You haven\'t asked anything yet. Open an upcoming session and post a question.</div>');
  } else {
    const list = v === 'sessions' ? sorted.filter(s => filter === 'all' || s.status === filter) : sorted;
    html = composer() + `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h2>${v === 'sessions' ? 'Live sessions' : 'Feed'}</h2>${v === 'sessions' ? `<div class="filter">${['all','upcoming','live','ended'].map(f => `<button class="${filter === f ? 'on' : ''}" data-a="filter" data-id="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>` : ''}</div>`
      + (list.map(s => sessionCard(s, false)).join('') || `<div class="card empty">${isHost ? 'No sessions yet. Announce your first live session above.' : 'No live sessions announced yet. Check back soon.'}</div>`);
  }
  // keep a half-typed question when live updates re-render
  const draft = $('#fQ')?.value, composeOpen = $('.compose')?.open;
  $('#main').innerHTML = html;
  if (draft && $('#fQ')) $('#fQ').value = draft;
  if (composeOpen && $('.compose')) $('.compose').open = true;
  $('#stM').textContent = Object.keys(profiles).length; $('#stS').textContent = sessions.length;
  $('#stQ').textContent = questions.length; $('#stA').textContent = questions.filter(q => q.answered).length;
  $('#meName').textContent = $('#menuName').textContent = nm(me); $('#menuEmail').textContent = meEmail;
  $('#meAv').textContent = $('#hdrAv').textContent = ini(me);
  $('#meRole').textContent = isHost ? 'Host' : 'Community member';
  renderNext();
}
function renderNext() {
  const el = $('#next'); if (!el) return;
  const s = sessions.find(x => x.status === 'live') || sessions.filter(x => x.status === 'upcoming').sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  if (!s) { el.innerHTML = '<h2>Next live session</h2><p class="mut">Nothing scheduled yet.</p>'; return; }
  const d = Math.max(0, new Date(s.starts_at) - Date.now()), p = [Math.floor(d / 864e5), Math.floor(d / 36e5) % 24, Math.floor(d / 6e4) % 60, Math.floor(d / 1e3) % 60];
  const url = safeUrl(s.zoom_url);
  el.innerHTML = `<h2>${s.status === 'live' ? 'Happening now' : 'Next live session'}</h2>${statusOf(s)}
   <p style="margin:10px 0 0;font-weight:600">${esc(s.title)}</p><div class="mut">${fmtD(s.starts_at)} · ${fmtT(s.starts_at)}</div>
   ${s.status === 'live' ? (url ? `<div class="zoom" style="background:rgb(255 255 255/.1);border-color:#fff"><a class="pri" href="${esc(url)}" target="_blank" rel="noopener">Join on Zoom</a></div>` : '')
     : `<div class="cd">${['Days','Hrs','Min','Sec'].map((l, i) => `<div><b>${p[i]}</b><span>${l}</span></div>`).join('')}</div>`}
   <button class="pri" style="width:100%" data-a="open" data-id="${s.id}">Ask a question (${qOf(s.id).length})</button>`;
}

/* ---------------- events ---------------- */
document.addEventListener('click', async e => {
  if (!e.target.closest('.menuwrap')) $('#menu').hidden = true;
  if (e.target.closest('#avBtn')) { $('#menu').hidden = !$('#menu').hidden; return; }
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a === 'open') { e.preventDefault(); open = id; render(); scrollTo(0, 0); }
  else if (a === 'close') { open = null; render(); }
  else if (a === 'filter') { filter = id; render(); }
  else if (a === 'signout') { await sb.auth.signOut(); }
  else if (a === 'rename') { $('#menu').hidden = true; $('#nameIn').value = nm(me); show('nameView'); }
  else if (a === 'vote') {
    b.disabled = true;
    const voted = votesOf(id).some(v => v.user_id === me);
    if (voted) { votes = votes.filter(v => !(v.question_id === id && v.user_id === me)); render(); await run(sb.from('votes').delete().eq('question_id', id).eq('user_id', me)); }
    else { votes.push({ question_id: id, user_id: me }); render(); await run(sb.from('votes').insert({ question_id: id, user_id: me })); }
    reload();
  }
  else if (a === 'ans') { const q = questions.find(x => x.id === id); if (await run(sb.from('questions').update({ answered: !q.answered }).eq('id', id))) reload(); }
  else if (a === 'delQ') { if (b.dataset.c) { if (await run(sb.from('questions').delete().eq('id', id), 'Question deleted')) reload(); } else { b.dataset.c = 1; b.textContent = 'Tap again to delete'; } }
  else if (a === 'delS') { if (b.dataset.c) { if (await run(sb.from('sessions').delete().eq('id', id), 'Session deleted')) { open = null; reload(); } } else { b.dataset.c = 1; b.textContent = 'Tap again to delete'; } }
  else if (a === 'golive' || a === 'zoom') {
    const s = sessions.find(x => x.id === id);
    b.parentElement.innerHTML = `<form id="zf" data-id="${id}" style="width:100%;display:flex;gap:8px;flex-wrap:wrap"><input id="zIn" type="url" required placeholder="Paste Zoom meeting link (https://…)" value="${esc(s.zoom_url || '')}" style="flex:1 1 240px"><button class="pri">${a === 'golive' ? 'Go live' : 'Save'}</button></form>`;
    $('#zIn').focus();
  }
  else if (a === 'end') { if (await run(sb.from('sessions').update({ status: 'ended' }).eq('id', id), 'Session ended')) reload(); }
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!['newS', 'newQ', 'zf'].includes(f.id)) return;
  e.preventDefault(); const btn = f.querySelector('button'); btn.disabled = true;
  if (f.id === 'newS') {
    const zoom = $('#fZ').value.trim();
    if (zoom && !safeUrl(zoom)) { toast('Zoom link must start with https://'); btn.disabled = false; return; }
    if (await run(sb.from('sessions').insert({ title: $('#fT').value.trim(), starts_at: new Date($('#fD').value).toISOString(), zoom_url: zoom || null, description: $('#fX').value.trim() }), 'Announcement posted')) { f.reset(); reload(); }
  } else if (f.id === 'newQ') {
    const body = $('#fQ').value.trim();
    if (await run(sb.from('questions').insert({ session_id: f.dataset.sid, body }), 'Question posted')) { $('#fQ').value = ''; reload(); }
  } else if (f.id === 'zf') {
    const url = $('#zIn').value.trim();
    if (!safeUrl(url)) { toast('Zoom link must start with https://'); btn.disabled = false; return; }
    if (await run(sb.from('sessions').update({ zoom_url: url, status: 'live' }).eq('id', f.dataset.id), 'You are live — members can see the Zoom link')) reload();
  }
  btn.disabled = false;
});
addEventListener('hashchange', () => { if (location.hash.startsWith('#access_token')) return; open = null; if (started) render(); });
setInterval(() => { if (started && !document.hidden) renderNext(); }, 1000);
})();
