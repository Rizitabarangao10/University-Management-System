// 1) Paste your Supabase project values (Project Settings > API)
const SUPABASE_URL='https://ggtfdkdbotoesxktugni.supabase.co',SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndGZka2Rib3RvZXN4a3R1Z25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5OTQyNTIsImV4cCI6MjEwODU3MDI1Mn0.zBmv3WaIuRc7XmkHJJpfC3Xe2dEaWULi83tASX2gyqk';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s),roles=['admin','teacher','student'],roleLabels={admin:'Admin',teacher:'Teacher',student:'Student'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me,cfg={},cur,gc,cache={},uFilter='all';
const toast=(m,bad)=>{const t=$('#toast');t.textContent=m;t.className='show'+(bad?' bad':'');setTimeout(()=>t.className='',3200)};
const q=async p=>{const{data,error}=await p;if(error){toast(error.message,1);return[]}return data||[]};
const rows=(t,sel='*',f=x=>x)=>q(f(db.from(t).select(sel)));
const btn=(a,id,l,c='')=>`<button class="btn sm ${c}" data-act="${a}" data-id="${id}">${l}</button>`;
const bar=(t,x='')=>`<div class="bar"><h2>${t}</h2><div>${x}</div></div>`;
const table=(cols,r)=>r.length?`<div class="tw"><table><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${r.map(x=>`<tr>${cols.map(c=>`<td>${c[1](x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nothing here yet.</p>';
const opts=(l,sel)=>l.map(o=>`<option value="${esc(o[0])}" ${o[0]==sel?'selected':''}>${esc(o[1])}</option>`).join('');
function form(title,f,v,save){const d=$('#dlg');
 d.innerHTML=`<form><h3>${title}</h3>${f.map(x=>`<label>${x.l}${x.o?`<select name="${x.n}">${opts(x.o,v[x.n])}</select>`:`<input name="${x.n}" type="${x.t||'text'}" value="${esc(v[x.n])}" ${x.r?'required':''}>`}</label>`).join('')}<div class="row"><button type="button" class="btn ghost" id="x">Cancel</button><button class="btn">Save</button></div></form>`;
 $('#x').onclick=()=>d.close();
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));for(const k in o)if(o[k]==='')o[k]=null;d.close();await save(o);go(cur)};d.showModal()}
const del=(t,k='id')=>async id=>{if(confirm('Delete this item?')){await q(db.from(t).delete().eq(k,id));go(cur)}};
const pass=()=>+cfg.pass_score||75;

// ---- Auth flow: login -> validate -> role -> dashboard -> logout
const fail=m=>{const e=$('#err');e.textContent=m;e.hidden=false;const p=$('[name=password]');p.value='';p.focus()};
async function loadCfg(){cfg=Object.fromEntries((await rows('settings')).map(s=>[s.key,s.value]));const n=cfg.university_name||'';$('#uni').textContent=n||'Sign in to continue';$('#uniS').textContent=n}
$('#loginForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),up=e.target.dataset.mode==='up';
 const role=f.role||'student';
 const{data,error}=up?await db.auth.signUp({email:f.email,password:f.password,options:{data:{full_name:f.full_name,role}}}):await db.auth.signInWithPassword({email:f.email,password:f.password});
 if(error)return fail(up?error.message:'Invalid credentials. Please try again.');
 if(!data.session)return fail('Check your email to confirm your account, then sign in.');
 if(up&&data.user){try{await db.from('profiles').update({role,full_name:f.full_name}).eq('id',data.user.id)}catch(_){}}
 enter(data.user)};
$('#toggle').onclick=()=>{const f=$('#loginForm'),up=f.dataset.mode==='in';f.dataset.mode=up?'up':'in';$('#nameF').hidden=!up;$('#roleF').hidden=!up;$('#submit').textContent=up?'Create account':'Sign in';$('#toggle').textContent=up?'Have an account? Sign in':'Need an account? Sign up';$('#err').hidden=true};
async function enter(u){await loadCfg();const{data:p}=await db.from('profiles').select('*').eq('id',u.id).maybeSingle();
 if(!p){await db.auth.signOut();return fail('No active profile for this account. Contact an administrator.')}
 me=p;$('#login').hidden=true;$('#app').hidden=false;$('#who').textContent=p.full_name||p.email;
 const rb=$('#role');rb.textContent=roleLabels[p.role]||p.role;rb.className='role-badge '+p.role;
 const v=VIEWS[p.role]||VIEWS.student;$('#nav').innerHTML=Object.entries(v).map(([k,x])=>`<button data-go="${k}">${x[0]}</button>`).join('');go(Object.keys(v)[0])}
$('#logout').onclick=async()=>{await db.auth.signOut();me=null;$('#app').hidden=true;$('#login').hidden=false;$('#err').hidden=true};
async function go(k){cur=k;document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===k));$('#main').innerHTML=await (VIEWS[me.role]||VIEWS.student)[k][1]()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]'),n=e.target.closest('[data-go]');if(b)A[b.dataset.act](b.dataset.id);if(n)go(n.dataset.go)});
document.addEventListener('change',async e=>{const t=e.target;if(t.id==='gc'){gc=t.value;go(cur)}
 if(t.dataset.role){await q(db.from('profiles').update({role:t.value}).eq('id',t.dataset.role));toast('Role updated')}});

// ---- Views
async function vUsers(){const p=await rows('profiles','*',x=>x.order('full_name'));
 const counts={all:p.length,admin:p.filter(x=>x.role==='admin').length,teacher:p.filter(x=>x.role==='teacher').length,student:p.filter(x=>x.role==='student').length};
 const filtered=uFilter==='all'?p:p.filter(x=>x.role===uFilter);
 const tabs=`<div class="tabs">${['all',...roles].map(r=>`<button class="btn sm ${uFilter===r?'':'ghost'}" data-act="filU" data-id="${r}">${r==='all'?'All':roleLabels[r]} (${counts[r]})</button>`).join('')}</div>`;
 return bar('Manage users',tabs)+table([['Name',r=>esc(r.full_name)],['Email',r=>esc(r.email)],['Role',r=>`<select data-role="${r.id}">${roles.map(o=>`<option value="${o}" ${o==r.role?'selected':''}>${roleLabels[o]}</option>`).join('')}</select>`],['',r=>btn('delU',r.id,'Remove','danger')]],filtered)}
async function vClasses(){const a=me.role==='admin';
 const c=cache.classes=await rows('classes','*,teacher:teacher_id(full_name),enrollments(count)',x=>a?x:x.eq('teacher_id',me.id));
 return bar(a?'Manage records':'My classes',btn('addC','','Add class'))+table([['Code',r=>esc(r.code)],['Class',r=>esc(r.name)],...(a?[['Teacher',r=>esc(r.teacher?.full_name)]]:[]),['Schedule',r=>esc([r.day,r.start_time?.slice(0,5),r.room].filter(Boolean).join(' '))],['Students',r=>r.enrollments[0].count],['',r=>btn('editC',r.id,'Edit')+(a?btn('enr',r.id,'Enroll'):'')+btn('delC',r.id,'Delete','danger')]],c)}
async function saveC(id){const a=me.role==='admin',t=a?(await rows('profiles','id,full_name',x=>x.eq('role','teacher'))).map(p=>[p.id,p.full_name]):[];
 form(id?'Edit class':'Add class',[{n:'code',l:'Code',r:1},{n:'name',l:'Class name',r:1},...(a?[{n:'teacher_id',l:'Teacher',o:[['','Unassigned'],...t]}]:[]),{n:'day',l:'Day'},{n:'start_time',l:'Start',t:'time'},{n:'end_time',l:'End',t:'time'},{n:'room',l:'Room'}],id?cache.classes.find(c=>c.id==id):{},
 async o=>{if(!a)o.teacher_id=me.id;await q(id?db.from('classes').update(o).eq('id',id):db.from('classes').insert(o))})}
async function vAnn(){const a=await rows('announcements','*',x=>x.order('created_at',{ascending:false})),ad=me.role==='admin';
 return bar('Announcements',ad?btn('addA','','Post announcement'):'')+(a.map(r=>`<article class="note"><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><small>${new Date(r.created_at).toLocaleDateString()}</small>${ad?btn('delA',r.id,'Delete','danger'):''}</article>`).join('')||'<p class="empty">No announcements yet.</p>')}
async function vSettings(){const s=await rows('settings','*',x=>x.order('key'));
 return bar('System settings',btn('addS','','Add setting'))+table([['Setting',r=>esc(r.key.replace(/_/g,' '))],['Value',r=>esc(r.value)],['',r=>btn('editS',r.key,'Edit')+btn('delS',r.key,'Delete','danger')]],s)}
async function vReports(){const a=me.role==='admin',cl=await rows('classes','id,name',x=>a?x:x.eq('teacher_id',me.id));
 const g=cl.length?await rows('grades','class_id,score',x=>x.in('class_id',cl.map(c=>c.id))):[];
 const d=window.csv=cl.map(c=>{const s=g.filter(x=>x.class_id==c.id&&x.score!=null).map(x=>+x.score);return{Class:c.name,Graded:s.length,Average:s.length?(s.reduce((x,y)=>x+y)/s.length).toFixed(1):'-',Highest:s.length?Math.max(...s):'-',Passing:s.filter(v=>v>=pass()).length}});
 let st='';if(a){const u=await rows('profiles','role');st=`<div class="stats">${roles.map(r=>`<div class="glass stat"><b>${u.filter(x=>x.role==r).length}</b>${r}s</div>`).join('')}<div class="glass stat"><b>${cl.length}</b>classes</div></div>`}
 return bar(a?'Reports':'Generate reports',btn('csv','','Export CSV'))+st+table(Object.keys(d[0]||{}).map(k=>[k,r=>esc(r[k])]),d)}
async function vGrades(){const cl=await rows('classes','id,name',x=>x.eq('teacher_id',me.id));gc=cl.find(c=>c.id==gc)?gc:cl[0]?.id;
 if(!gc)return bar('Input grades')+'<p class="empty">Create a class first.</p>';
 const en=await rows('enrollments','student:student_id(id,full_name)',x=>x.eq('class_id',gc)),g=await rows('grades','*',x=>x.eq('class_id',gc)),f=r=>g.find(x=>x.student_id==r.student.id);
 return bar('Input grades',`<select id="gc">${opts(cl.map(c=>[c.id,c.name]),gc)}</select>`)+table([['Student',r=>esc(r.student.full_name)],['Score',r=>`<input type="number" min="0" max="${cfg.max_score||100}" step="0.01" id="s${r.student.id}" value="${f(r)?.score??''}">`],['Remarks',r=>`<input id="r${r.student.id}" value="${esc(f(r)?.remarks)}">`],['',r=>btn('saveG',r.student.id,'Save')]],en)}
async function vStudents(){const e=await rows('enrollments','class_id,student_id,student:student_id(full_name,email),class:class_id!inner(name,teacher_id)',x=>x.eq('class.teacher_id',me.id)),g=await rows('grades','class_id,student_id,score');
 return bar('Student records')+table([['Student',r=>esc(r.student.full_name)],['Email',r=>esc(r.student.email)],['Class',r=>esc(r.class.name)],['Score',r=>g.find(x=>x.class_id==r.class_id&&x.student_id==r.student_id)?.score??'-']],e)}
async function vMyGrades(){const g=await rows('grades','*,class:class_id(code,name)',x=>x.eq('student_id',me.id));
 return bar('My grades')+table([['Class',r=>esc(r.class.code+' '+r.class.name)],['Score',r=>r.score??'-'],['Remarks',r=>esc(r.remarks)],['Status',r=>r.score==null?'Pending':r.score>=pass()?'Passed':'Failed']],g)}
async function vSchedule(){const e=await rows('enrollments','class:class_id(*)',x=>x.eq('student_id',me.id));
 return bar('My schedule')+table([['Class',r=>esc(r.class.name)],['Day',r=>esc(r.class.day)],['Time',r=>esc((r.class.start_time||'').slice(0,5)+' - '+(r.class.end_time||'').slice(0,5))],['Room',r=>esc(r.class.room)]],e)}
const vProfile=async()=>bar('Profile',btn('editP','','Edit name'))+`<div class="glass card"><div><small>Name</small><br>${esc(me.full_name)}</div><div><small>Email</small><br>${esc(me.email)}</div><div><small>Role</small><br><span class="role-badge ${me.role}">${roleLabels[me.role]||me.role}</span></div></div>`;
const VIEWS={admin:{users:['Manage users',vUsers],classes:['Manage records',vClasses],reports:['View reports',vReports],announcements:['Announcements',vAnn],settings:['System settings',vSettings]},
 teacher:{classes:['Manage classes',vClasses],grades:['Input grades',vGrades],students:['Student records',vStudents],announcements:['Announcements',vAnn],reports:['Generate reports',vReports]},
 student:{grades:['View grades',vMyGrades],profile:['View profile',vProfile],announcements:['Announcements',vAnn],schedule:['View schedule',vSchedule]}};

// ---- Actions
const saveS=async o=>{await q(db.from('settings').upsert(o));await loadCfg()};
const A={filU:id=>{uFilter=id;go(cur)},addC:()=>saveC(),editC:saveC,delC:del('classes'),delU:del('profiles'),delA:del('announcements'),delS:del('settings','key'),
 addA:()=>form('Post announcement',[{n:'title',l:'Title',r:1},{n:'body',l:'Message'}],{},o=>q(db.from('announcements').insert(o))),
 addS:()=>form('Add setting',[{n:'key',l:'Key (e.g. pass_score)',r:1},{n:'value',l:'Value'}],{},saveS),
 editS:k=>form('Edit '+k,[{n:'value',l:'Value'}],{value:cfg[k]},o=>saveS({key:k,value:o.value})),
 editP:()=>form('Edit profile',[{n:'full_name',l:'Full name',r:1}],me,async o=>{await q(db.from('profiles').update(o).eq('id',me.id));me.full_name=o.full_name;$('#who').textContent=o.full_name}),
 enr:async cid=>{const s=await rows('profiles','id,full_name',x=>x.eq('role','student'));form('Enroll student',[{n:'student_id',l:'Student',o:s.map(p=>[p.id,p.full_name])}],{},o=>q(db.from('enrollments').insert({class_id:cid,student_id:o.student_id})))},
 saveG:async sid=>{const s=$('#s'+sid).value;await q(db.from('grades').upsert({class_id:gc,student_id:sid,score:s===''?null:+s,remarks:$('#r'+sid).value},{onConflict:'class_id,student_id'}));toast('Grade saved')},
 csv:()=>{const d=window.csv;if(!d.length)return toast('No data to export',1);const k=Object.keys(d[0]),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[k,...d.map(r=>k.map(c=>`"${r[c]}"`))].join('\n')],{type:'text/csv'}));a.download='report.csv';a.click()}};

(async()=>{await loadCfg();const{data:{session}}=await db.auth.getSession();if(session)enter(session.user)})();
