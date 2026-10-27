// 1) Paste your Supabase project values (Project Settings > API)
const SUPABASE_URL = 'https://ggtfdkdbotoesxktugni.supabase.co', SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndGZka2Rib3RvZXN4a3R1Z25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5OTQyNTIsImV4cCI6MjEwODU3MDI1Mn0.zBmv3WaIuRc7XmkHJJpfC3Xe2dEaWULi83tASX2gyqk';
// Detect recovery links from email (#...type=recovery) before Supabase clears the hash
let recovering = /type=recovery/.test(location.hash);
const hashErr = new URLSearchParams(location.hash.slice(1)).get('error_description');
let otpOk = false;

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = s => document.querySelector(s), roles = ['admin', 'teacher', 'student'], roleLabels = { admin: 'Admin', teacher: 'Teacher', student: 'Student' };
const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let me, cfg = {}, cur, gc, cache = {}, uFilter = 'all';
function updateAvatarUI() { const av = me?.avatar_url || localStorage.getItem('avatar_' + me?.id) || defaultAvatar; const a = $('#myAvatar'); if (a) a.src = av; const p = $('#profImg'); if (p) p.src = av }

async function handlePngUpload(file) {
  if (!file) return;
  const isPng = (file.type === 'image/png') || file.name.toLowerCase().endsWith('.png');
  if (!isPng) {
    toast('Error: Only PNG (.png) files are supported.', 1);
    const fi = $('#avatarFileInput'); if (fi) fi.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) { toast('Image file is too large (maximum 5MB allowed).', 1); return }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas'), size = 256;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'), minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2, sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      const pngData = canvas.toDataURL('image/png');
      me.avatar_url = pngData;
      try { localStorage.setItem('avatar_' + me.id, pngData) } catch (_) { }
      updateAvatarUI();
      try { await db.from('profiles').update({ avatar_url: pngData }).eq('id', me.id) } catch (e) { console.warn('Avatar db update:', e) }
      toast('Profile picture updated successfully!');
      if (cur === 'profile' || cur === 'users') go(cur);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

async function removeAvatar() {
  if (!confirm('Are you sure you want to remove your profile picture?')) return;
  me.avatar_url = null;
  try { localStorage.removeItem('avatar_' + me.id) } catch (_) { }
  updateAvatarUI();
  try { await db.from('profiles').update({ avatar_url: null }).eq('id', me.id) } catch (_) { }
  toast('Profile picture removed.');
  if (cur === 'profile') go(cur);
}

const toast = (m, bad) => { const t = $('#toast'); t.textContent = m; t.className = 'show' + (bad ? ' bad' : ''); setTimeout(() => t.className = '', 3200) };
const q = async p => { const { data, error } = await p; if (error) { toast(error.message, 1); return [] } return data || [] };
const rows = (t, sel = '*', f = x => x) => q(f(db.from(t).select(sel)));
const btn = (a, id, l, c = '') => `<button class="btn sm ${c}" data-act="${a}" data-id="${id}">${l}</button>`;
const bar = (t, x = '') => `<div class="bar"><h2>${t}</h2><div>${x}</div></div>`;
const table = (cols, r) => r.length ? `<div class="tw"><table><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${r.map(x => `<tr>${cols.map(c => `<td>${c[1](x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nothing here yet.</p>';
const opts = (l, sel) => l.map(o => `<option value="${esc(o[0])}" ${o[0] == sel ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
function form(title, f, v, save) {
  const d = $('#dlg');
  d.innerHTML = `<form><h3>${title}</h3>${f.map(x => `<label>${x.l}${x.o ? `<select name="${x.n}">${opts(x.o, v[x.n])}</select>` : `<input name="${x.n}" type="${x.t || 'text'}" value="${esc(v[x.n])}" ${x.r ? 'required' : ''}>`}</label>`).join('')}<div class="row"><button type="button" class="btn ghost" id="x">Cancel</button><button class="btn">Save</button></div></form>`;
  $('#x').onclick = () => d.close();
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); for (const k in o) if (o[k] === '') o[k] = null; d.close(); await save(o); go(cur) }; d.showModal()
}
const del = (t, k = 'id') => async id => { if (confirm('Are you sure you want to delete this item?')) { await q(db.from(t).delete().eq(k, id)); go(cur) } };
const pass = () => +cfg.pass_score || 75;

// ---- Auth flow: login -> validate -> role -> dashboard -> logout
const fail = m => {
  const e = $('#err');
  let msg = typeof m === 'object' ? (m?.message || JSON.stringify(m)) : String(m || '');
  if (!msg || msg === '{}' || msg === 'null' || msg === 'undefined') {
    msg = 'Unable to send email. If Custom SMTP is enabled in Supabase without full configuration, please turn it OFF in your Supabase Dashboard > Project Settings > Auth > SMTP Settings.';
  }
  if (msg.includes('Signups not allowed')) {
    e.innerHTML = '<b>Signups not allowed:</b> Public user registration is currently disabled in your Supabase project.<br><small style="font-weight:normal;display:block;margin-top:4px">Go to <b>Supabase Dashboard &gt; Authentication &gt; Providers &gt; Email</b> and enable <b>"Allow new users to sign up"</b>.</small>';
  } else if (msg.toLowerCase().includes('rate limit')) {
    e.textContent = 'Too many email requests. Please wait 60 seconds before trying again.';
  } else {
    e.textContent = msg;
  }
  e.hidden = false; $('#ok').hidden = true;
  const p = $('[name=password]'); if (p) { p.value = ''; p.focus(); }
};
async function loadCfg() { cfg = Object.fromEntries((await rows('settings')).map(s => [s.key, s.value])); const n = (cfg.university_name && cfg.university_name !== 'My University') ? cfg.university_name : 'National University'; $('#uni').textContent = n; $('#uniS').textContent = n }
const good = m => { const o = $('#ok'); o.textContent = m; o.hidden = false; $('#err').hidden = true };
// Form modes: in (sign in) | up (sign up) | forgot (request OTP/link) | reset (enter code or new password)
function setMode(m) {
  const f = $('#loginForm'); f.dataset.mode = m;
  const show = (id, v) => { const el = $(id); el.hidden = !v; el.querySelectorAll('input,select').forEach(i => i.disabled = !v) };
  show('#nameF', m === 'up'); show('#roleF', m === 'up'); show('#codeF', m === 'reset' && !recovering); show('#emailF', m !== 'reset' || !recovering); show('#passF', m !== 'forgot');
  $('#forgot').hidden = m !== 'in' && m !== 'reset'; $('#forgot').textContent = m === 'reset' ? 'Resend code' : 'Forgot password?'; if (m !== 'reset') otpOk = false;
  $('#submit').textContent = { in: 'Sign in', up: 'Create account', forgot: 'Send reset email', reset: 'Reset password' }[m];
  $('#toggle').textContent = { in: 'Need an account? Sign up', up: 'Have an account? Sign in', forgot: 'Back to sign in', reset: 'Back to sign in' }[m] || '';
  $('#passL').textContent = m === 'reset' ? 'New password' : 'Password';
  $('[name=password]').autocomplete = m === 'in' ? 'current-password' : 'new-password';
  $('[name=password]').value = ''; $('#err').hidden = true; $('#ok').hidden = true
}
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const m = e.target.dataset.mode, f = Object.fromEntries(new FormData(e.target));
  if (m === 'forgot') {
    const { error } = await db.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: location.href.split(/[?#]/)[0] });
    if (error) return fail(error.message || error);
    setMode('reset'); return good('We sent reset instructions to ' + f.email.trim() + '. Check your email for a code or link.')
  }
  if (m === 'reset') {
    if (!recovering && !otpOk) {
      const token = (f.code || '').replace(/\s+/g, '').trim();
      const { error: oe } = await db.auth.verifyOtp({ email: (f.email || $('[name=email]').value).trim(), token, type: 'recovery' });
      if (oe) return fail(oe.message || 'Invalid or expired verification code. Please check your email or tap Resend code.');
      otpOk = true;
    }
    const { error } = await db.auth.updateUser({ password: f.password });
    if (error) return fail(error.message || error);
    otpOk = false; recovering = false; await db.auth.signOut(); history.replaceState(null, '', location.pathname + location.search);
    setMode('in'); return good('Password updated! Please sign in with your new password.')
  }
  const up = m === 'up';
  const role = f.role === 'teacher' ? 'teacher' : 'student'; // admin accounts can't be self-registered
  const { data, error } = up ? await db.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.full_name, role } } }) : await db.auth.signInWithPassword({ email: f.email, password: f.password });
  if (error) return fail(up ? error.message : 'Invalid credentials. Please try again.');
  if (!data.session) return fail('Check your email to confirm your account, then sign in.');
  if (up && data.user) { try { await db.from('profiles').update({ role, full_name: f.full_name }).eq('id', data.user.id) } catch (_) { } }
  enter(data.user)
};
$('#toggle').onclick = () => setMode($('#loginForm').dataset.mode === 'in' ? 'up' : 'in');
$('#forgot').onclick = async () => { if ($('#loginForm').dataset.mode === 'in') return setMode('forgot'); const { error } = await db.auth.resetPasswordForEmail($('[name=email]').value.trim()); error ? fail(error.message || error) : good('A new verification code has been sent to your email.') };

// ---- Realtime Synchronization
let realtimeChan = null;
function stopRealtime() {
  if (realtimeChan) {
    try { db.removeChannel(realtimeChan) } catch (_) { }
    realtimeChan = null;
  }
  const dot = $('#liveDot'); if (dot) dot.className = 'live-dot';
}

function startRealtime() {
  stopRealtime();
  try {
    realtimeChan = db.channel('ums-realtime-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grades' }, p => handleRealtimeEvent('grades', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, p => handleRealtimeEvent('classes', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, p => handleRealtimeEvent('enrollments', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, p => handleRealtimeEvent('announcements', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, p => handleRealtimeEvent('profiles', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, p => handleRealtimeEvent('settings', p))
      .subscribe(status => {
        const dot = $('#liveDot');
        if (dot) {
          dot.className = 'live-dot ' + (status === 'SUBSCRIBED' ? 'active' : 'connecting');
          dot.title = status === 'SUBSCRIBED' ? 'Realtime sync active' : 'Connecting realtime...';
        }
      });
  } catch (e) { console.warn('Realtime init:', e) }
}

function handleRealtimeEvent(t, payload) {
  if (t === 'announcements') {
    if (payload.eventType === 'INSERT') toast('New announcement: ' + (payload.new?.title || 'Notice'));
    if (cur === 'announcements') go(cur);
    return;
  }
  if (t === 'grades') {
    if (me?.role === 'student') {
      if (payload.new?.student_id === me.id || payload.old?.student_id === me.id) {
        toast('Your grades have been updated!');
        if (cur === 'grades') go(cur);
      }
      return;
    }
    if (cur === 'reports' || cur === 'students') { go(cur); return }
    if (cur === 'grades') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
      go(cur);
    }
    return;
  }
  if (t === 'classes') {
    if (cur === 'classes' || cur === 'grades' || cur === 'reports' || cur === 'schedule') go(cur);
    return;
  }
  if (t === 'enrollments') {
    if (cur === 'classes' || cur === 'grades' || cur === 'students' || cur === 'schedule') go(cur);
    return;
  }
  if (t === 'profiles') {
    if (payload.new?.id === me?.id) {
      me = { ...me, ...payload.new };
      $('#who').textContent = me.full_name || me.email;
      const rb = $('#role'); if (rb) { rb.textContent = roleLabels[me.role] || me.role; rb.className = 'role-badge ' + me.role }
      updateAvatarUI();
    }
    if (cur === 'users') go(cur);
    return;
  }
  if (t === 'settings') {
    loadCfg();
    if (cur === 'settings' || cur === 'reports') go(cur);
    return;
  }
}

async function enter(u) {
  await loadCfg(); const { data: p } = await db.from('profiles').select('*').eq('id', u.id).maybeSingle();
  if (!p) { await db.auth.signOut(); return fail('No active profile for this account. Contact an administrator.') }
  p.role = (p.role || 'student').toLowerCase().trim();
  p.avatar_url = p.avatar_url || localStorage.getItem('avatar_' + p.id) || null;
  me = p; $('#login').hidden = true; $('#app').hidden = false; $('#who').textContent = p.full_name || p.email;
  const rb = $('#role'); rb.textContent = roleLabels[p.role] || p.role; rb.className = 'role-badge ' + p.role;
  updateAvatarUI();
  startRealtime();
  const v = VIEWS[p.role] || VIEWS.student; $('#nav').innerHTML = Object.entries(v).map(([k, x]) => `<button data-go="${k}">${x[0]}</button>`).join(''); go(Object.keys(v)[0])
}

async function doLogout() {
  stopRealtime();
  me = null;
  cur = null;
  const sm = $('#sideMenu'); if (sm) sm.classList.remove('open');
  const tb = $('#navToggleBtn'); if (tb) tb.classList.remove('active');
  $('#main').innerHTML = '';
  $('#nav').innerHTML = '';
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#err').hidden = true;
  $('#ok').hidden = true;
  window.scrollTo(0, 0);
  try { await db.auth.signOut() } catch (_) { }
}

$('#logout').onclick = doLogout;

async function go(k) {
  if (!me) return;
  cur = k;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === k));
  $('#main').innerHTML = await (VIEWS[me.role] || VIEWS.student)[k][1]();
  window.scrollTo(0, 0);
}

function closeMobileMenu() {
  const sm = $('#sideMenu');
  if (sm && sm.classList.contains('open')) {
    sm.classList.remove('open');
    const tb = $('#navToggleBtn');
    if (tb) tb.classList.remove('active');
  }
}

// Auto-close mobile menu on scroll
window.addEventListener('scroll', () => {
  closeMobileMenu();
}, { passive: true });

// Prevent scroll gestures on touchscreen from triggering accidental button clicks
let touchStartX = 0, touchStartY = 0, isTouchScrolling = false;

document.addEventListener('touchstart', e => {
  if (e.touches && e.touches[0]) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isTouchScrolling = false;
  }
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (e.touches && e.touches[0]) {
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 8 || dy > 8) {
      isTouchScrolling = true;
    }
  }
}, { passive: true });

document.addEventListener('touchend', () => {
  // Clear the scroll flag shortly after gesture finishes
  setTimeout(() => { isTouchScrolling = false; }, 200);
}, { passive: true });

document.addEventListener('click', e => {
  if (isTouchScrolling) {
    isTouchScrolling = false;
    return;
  }

  const tBtn = e.target.closest('#navToggleBtn');
  if (tBtn) {
    const sm = $('#sideMenu');
    if (sm) {
      sm.classList.toggle('open');
      tBtn.classList.toggle('active', sm.classList.contains('open'));
    }
    return;
  }

  // Click outside sidebar closes the mobile navigation menu
  if (!e.target.closest('.side')) {
    closeMobileMenu();
  }

  if (e.target.closest('#profLogoutBtn')) {
    doLogout();
    return;
  }
  const b = e.target.closest('[data-act]'), n = e.target.closest('[data-go]');
  if (b) A[b.dataset.act](b.dataset.id);
  if (n) {
    go(n.dataset.go);
    closeMobileMenu();
  }
  if (e.target.closest('#sidebarAvatarBtn') || e.target.closest('#btnUploadPng')) {
    const fi = $('#avatarFileInput'); if (fi) { fi.value = ''; fi.click() }
  }
  if (e.target.closest('#btnRemovePng')) removeAvatar();
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.classList.contains('grade-input')) {
    const sid = t.dataset.sid || t.id.replace('s', '');
    const r = $('#r' + sid);
    if (!r) return;
    const v = t.value.trim();
    if (v === '') {
      r.value = '';
      r.className = 'remarks-input';
    } else {
      const n = parseFloat(v);
      if (isNaN(n)) {
        r.value = '';
        r.className = 'remarks-input';
      } else if (n >= 75) {
        r.value = 'Passed';
        r.className = 'remarks-input passed';
      } else {
        r.value = 'Failed';
        r.className = 'remarks-input failed';
      }
    }
  }
});

const avatarInputEl = $('#avatarFileInput');
if (avatarInputEl) {
  avatarInputEl.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) handlePngUpload(e.target.files[0]);
  });
}

document.addEventListener('change', async e => {
  const t = e.target; if (t.id === 'gc') { gc = t.value; go(cur) }
  if (t.dataset.role) { await q(db.from('profiles').update({ role: t.value.toLowerCase().trim() }).eq('id', t.dataset.role)); toast('Role updated successfully.') }
});

// ---- Views
async function vUsers() {
  const p = await rows('profiles', '*', x => x.order('full_name'));
  const counts = { all: p.length, admin: p.filter(x => x.role === 'admin').length, teacher: p.filter(x => x.role === 'teacher').length, student: p.filter(x => x.role === 'student').length };
  const filtered = uFilter === 'all' ? p : p.filter(x => x.role === uFilter);
  const tabs = `<div class="tabs">${['all', ...roles].map(r => `<button class="btn sm ${uFilter === r ? '' : 'ghost'}" data-act="filU" data-id="${r}">${r === 'all' ? 'All' : roleLabels[r]} (${counts[r]})</button>`).join('')}</div>`;
  return bar('Manage users', tabs) + table([
    ['User', r => `<div class="user-cell"><img class="tbl-avatar" src="${r.avatar_url || localStorage.getItem('avatar_' + r.id) || defaultAvatar}"><span>${esc(r.full_name)}</span></div>`],
    ['Email', r => esc(r.email)],
    ['Role', r => `<select data-role="${r.id}">${roles.map(o => `<option value="${o}" ${o == r.role ? 'selected' : ''}>${roleLabels[o]}</option>`).join('')}</select>`],
    ['', r => btn('delU', r.id, 'Remove', 'danger')]
  ], filtered)
}

async function vClasses() {
  const a = me.role === 'admin';
  const c = cache.classes = await rows('classes', '*,teacher:teacher_id(full_name),enrollments(count)', x => a ? x : x.eq('teacher_id', me.id));
  return bar(a ? 'Manage records' : 'My classes', btn('addC', '', 'Add class')) + table([['Code', r => esc(r.code)], ['Class', r => esc(r.name)], ...(a ? [['Teacher', r => esc(r.teacher?.full_name)]] : []), ['Schedule', r => esc([r.day, r.start_time?.slice(0, 5), r.room].filter(Boolean).join(' '))], ['Students', r => r.enrollments[0].count], ['', r => btn('editC', r.id, 'Edit') + (a ? btn('enr', r.id, 'Enroll') : '') + btn('delC', r.id, 'Delete', 'danger')]], c)
}

async function saveC(id) {
  const a = me.role === 'admin', t = a ? (await rows('profiles', 'id,full_name', x => x.eq('role', 'teacher'))).map(p => [p.id, p.full_name]) : [];
  form(id ? 'Edit class' : 'Add class', [{ n: 'code', l: 'Code', r: 1 }, { n: 'name', l: 'Class name', r: 1 }, ...(a ? [{ n: 'teacher_id', l: 'Teacher', o: [['', 'Unassigned'], ...t] }] : []), { n: 'day', l: 'Day' }, { n: 'start_time', l: 'Start', t: 'time' }, { n: 'end_time', l: 'End', t: 'time' }, { n: 'room', l: 'Room' }], id ? cache.classes.find(c => c.id == id) : {},
    async o => { if (!a) o.teacher_id = me.id; await q(id ? db.from('classes').update(o).eq('id', id) : db.from('classes').insert(o)) })
}

async function vAnn() {
  const a = await rows('announcements', '*', x => x.order('created_at', { ascending: false })), ad = me.role === 'admin';
  return bar('Announcements', ad ? btn('addA', '', 'Post announcement') : '') + (a.map(r => `<article class="note"><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><small>${new Date(r.created_at).toLocaleDateString()}</small>${ad ? btn('delA', r.id, 'Delete', 'danger') : ''}</article>`).join('') || '<p class="empty">No announcements yet.</p>')
}

async function vSettings() {
  const s = await rows('settings', '*', x => x.order('key'));
  return bar('System settings', btn('addS', '', 'Add setting')) + table([['Setting', r => esc(r.key.replace(/_/g, ' '))], ['Value', r => esc(r.value)], ['', r => btn('editS', r.key, 'Edit') + btn('delS', r.key, 'Delete', 'danger')]], s)
}

async function vReports() {
  const a = me.role === 'admin', cl = await rows('classes', 'id,name', x => a ? x : x.eq('teacher_id', me.id));
  const g = cl.length ? await rows('grades', 'class_id,score', x => x.in('class_id', cl.map(c => c.id))) : [];
  const d = window.csv = cl.map(c => { const s = g.filter(x => x.class_id == c.id && x.score != null).map(x => +x.score); return { Class: c.name, Graded: s.length, Average: s.length ? (s.reduce((x, y) => x + y) / s.length).toFixed(1) : '-', Highest: s.length ? Math.max(...s) : '-', Passing: s.filter(v => v >= pass()).length } });
  let st = ''; if (a) { const u = await rows('profiles', 'role'); st = `<div class="stats">${roles.map(r => `<div class="glass stat"><b>${u.filter(x => x.role == r).length}</b>${r}s</div>`).join('')}<div class="glass stat"><b>${cl.length}</b>classes</div></div>` }
  return bar(a ? 'Reports' : 'Generate reports', btn('csv', '', 'Export CSV')) + st + table(Object.keys(d[0] || {}).map(k => [k, r => esc(r[k])]), d)
}

async function vGrades() {
  const cl = await rows('classes', 'id,name', x => x.eq('teacher_id', me.id)); gc = cl.find(c => c.id == gc) ? gc : cl[0]?.id;
  if (!gc) return bar('Input grades') + '<p class="empty">Create a class first.</p>';
  const en = await rows('enrollments', 'student:student_id(id,full_name,avatar_url)', x => x.eq('class_id', gc)), g = await rows('grades', '*', x => x.eq('class_id', gc)), f = r => g.find(x => x.student_id == r.student.id);
  return bar('Input grades', `<select id="gc">${opts(cl.map(c => [c.id, c.name]), gc)}</select>`) + table([
    ['Student', r => `<div class="user-cell"><img class="tbl-avatar" src="${r.student?.avatar_url || localStorage.getItem('avatar_' + r.student?.id) || defaultAvatar}"><span>${esc(r.student?.full_name)}</span></div>`],
    ['Grade', r => `<input type="number" min="0" max="${cfg.max_score || 100}" step="0.01" class="grade-input" data-sid="${r.student.id}" id="s${r.student.id}" value="${f(r)?.score ?? ''}" placeholder="e.g. 85">`],
    ['Remarks', r => {
      const gr = f(r)?.score;
      let rem = f(r)?.remarks;
      if (!rem && gr != null) { rem = +gr >= 75 ? 'Passed' : 'Failed' }
      if (rem === 'Pasado') rem = 'Passed';
      if (rem === 'Bagsak') rem = 'Failed';
      const cls = rem === 'Passed' ? 'passed' : rem === 'Failed' ? 'failed' : '';
      return `<input id="r${r.student.id}" class="remarks-input ${cls}" value="${esc(rem)}" placeholder="Passed / Failed">`;
    }],
    ['', r => btn('saveG', r.student.id, 'Save')]
  ], en)
}

async function vStudents() {
  const e = await rows('enrollments', 'class_id,student_id,student:student_id(id,full_name,email,avatar_url),class:class_id!inner(name,teacher_id)', x => x.eq('class.teacher_id', me.id)), g = await rows('grades', 'class_id,student_id,score,remarks');
  return bar('Student records') + table([
    ['Student', r => `<div class="user-cell"><img class="tbl-avatar" src="${r.student?.avatar_url || localStorage.getItem('avatar_' + r.student?.id) || defaultAvatar}"><span>${esc(r.student?.full_name)}</span></div>`],
    ['Email', r => esc(r.student?.email)],
    ['Class', r => esc(r.class?.name)],
    ['Grade', r => g.find(x => x.class_id == r.class_id && x.student_id == r.student_id)?.score ?? '-'],
    ['Remarks', r => {
      const found = g.find(x => x.class_id == r.class_id && x.student_id == r.student_id);
      if (!found || found.score == null) return '<span class="badge-status pending">-</span>';
      let rem = found.remarks || (+found.score >= 75 ? 'Passed' : 'Failed');
      if (rem === 'Pasado') rem = 'Passed';
      if (rem === 'Bagsak') rem = 'Failed';
      const cls = rem === 'Passed' ? 'passed' : 'failed';
      return `<span class="badge-status ${cls}">${esc(rem)}</span>`;
    }]
  ], e)
}

async function vMyGrades() {
  const g = await rows('grades', '*,class:class_id(code,name)', x => x.eq('student_id', me.id));
  return bar('My grades') + table([
    ['Class', r => esc(r.class?.code + ' ' + r.class?.name)],
    ['Grade', r => r.score ?? '-'],
    ['Remarks', r => {
      if (r.score == null) return '-';
      let rem = r.remarks || (+r.score >= 75 ? 'Passed' : 'Failed');
      if (rem === 'Pasado') rem = 'Passed';
      if (rem === 'Bagsak') rem = 'Failed';
      const cls = rem === 'Passed' ? 'passed' : 'failed';
      return `<span class="badge-status ${cls}">${esc(rem)}</span>`;
    }],
    ['Status', r => r.score == null ? '<span class="badge-status pending">Pending</span>' : (+r.score >= 75 ? '<span class="badge-status passed">Passed</span>' : '<span class="badge-status failed">Failed</span>')]
  ], g)
}

async function vSchedule() {
  const e = await rows('enrollments', 'class:class_id(*)', x => x.eq('student_id', me.id));
  return bar('My schedule') + table([['Class', r => esc(r.class.name)], ['Day', r => esc(r.class.day)], ['Time', r => esc((r.class.start_time || '').slice(0, 5) + ' - ' + (r.class.end_time || '').slice(0, 5))], ['Room', r => esc(r.class.room)]], e)
}

const vProfile = async () => {
  const av = me.avatar_url || localStorage.getItem('avatar_' + me.id) || defaultAvatar;
  return bar('My profile', btn('editP', '', 'Edit name')) + `
  <div class="glass card profile-card">
    <div class="profile-avatar-sec">
      <img id="profImg" class="prof-avatar-lg" src="${av}" alt="Avatar">
      <div class="avatar-actions">
        <button type="button" class="btn sm" id="btnUploadPng">Upload PNG picture</button>
        ${(me.avatar_url || localStorage.getItem('avatar_' + me.id)) ? `<button type="button" class="btn sm ghost" id="btnRemovePng">Remove picture</button>` : ''}
        <span class="hint-text">Only <b>.PNG</b> image files are accepted.</span>
      </div>
    </div>
    <div class="profile-details">
      <div><small>Full Name</small><br><b>${esc(me.full_name)}</b></div>
      <div><small>Email</small><br><b>${esc(me.email)}</b></div>
      <div><small>Role</small><br><span class="role-badge ${me.role}">${roleLabels[me.role] || me.role}</span></div>
    </div>
    <div class="profile-logout-sec">
      <button type="button" class="btn danger wide" id="profLogoutBtn">Log out</button>
    </div>
  </div>`;
};

const VIEWS = {
  admin: { users: ['Manage users', vUsers], classes: ['Manage records', vClasses], reports: ['View reports', vReports], announcements: ['Announcements', vAnn], settings: ['System settings', vSettings], profile: ['My profile', vProfile] },
  teacher: { classes: ['Manage classes', vClasses], grades: ['Input grades', vGrades], students: ['Student records', vStudents], announcements: ['Announcements', vAnn], reports: ['Generate reports', vReports], profile: ['My profile', vProfile] },
  student: { grades: ['View grades', vMyGrades], profile: ['My profile', vProfile], announcements: ['Announcements', vAnn], schedule: ['View schedule', vSchedule] }
};

// ---- Actions
const saveS = async o => { await q(db.from('settings').upsert(o)); await loadCfg() };
const A = {
  filU: id => { uFilter = id; go(cur) }, addC: () => saveC(), editC: saveC, delC: del('classes'), delU: del('profiles'), delA: del('announcements'), delS: del('settings', 'key'),
  addA: () => form('Post announcement', [{ n: 'title', l: 'Title', r: 1 }, { n: 'body', l: 'Message' }], {}, o => q(db.from('announcements').insert(o))),
  addS: () => form('Add setting', [{ n: 'key', l: 'Key (e.g. pass_score)', r: 1 }, { n: 'value', l: 'Value' }], {}, saveS),
  editS: k => form('Edit ' + k, [{ n: 'value', l: 'Value' }], { value: cfg[k] }, o => saveS({ key: k, value: o.value })),
  editP: () => form('Edit profile', [{ n: 'full_name', l: 'Full name', r: 1 }], me, async o => { await q(db.from('profiles').update(o).eq('id', me.id)); me.full_name = o.full_name; $('#who').textContent = o.full_name }),
  enr: async cid => { const s = await rows('profiles', 'id,full_name', x => x.eq('role', 'student')); form('Enroll student', [{ n: 'student_id', l: 'Student', o: s.map(p => [p.id, p.full_name]) }], {}, o => q(db.from('enrollments').insert({ class_id: cid, student_id: o.student_id }))) },
  saveG: async sid => {
    const s = $('#s' + sid).value.trim(), r = $('#r' + sid).value.trim();
    const scoreVal = s === '' ? null : +s;
    let remVal = r || (scoreVal != null ? (scoreVal >= 75 ? 'Passed' : 'Failed') : null);
    if (remVal === 'Pasado') remVal = 'Passed';
    if (remVal === 'Bagsak') remVal = 'Failed';
    await q(db.from('grades').upsert({ class_id: gc, student_id: sid, score: scoreVal, remarks: remVal }, { onConflict: 'class_id,student_id' }));
    toast('Grade saved successfully.');
  },
  csv: () => { const d = window.csv; if (!d.length) return toast('No data to export', 1); const k = Object.keys(d[0]), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[k, ...d.map(r => k.map(c => `"${r[c]}"`))].join('\n')], { type: 'text/csv' })); a.download = 'report.csv'; a.click() }
};

db.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; $('#app').hidden = true; $('#login').hidden = false; setMode('reset'); good('Enter your new password below.') } });
(async () => {
  setMode('in'); await loadCfg();
  if (hashErr) { history.replaceState(null, '', location.pathname + location.search); setMode('forgot'); return fail(decodeURIComponent(hashErr.replace(/\+/g, ' ')) + '. Please request a new reset email.') }
  const { data: { session } } = await db.auth.getSession();
  if (recovering && session) { setMode('reset'); good('Enter your new password below.'); return }
  if (session && !recovering) enter(session.user)
})();
