// ==========================================
// 定数
// ==========================================
const DAYS    = ['月','火','水','木','金'];
const PERIODS = [1,2,3,4,5,6];
const ALL_CLASSES = [
  '1年1組','1年2組','1年3組',
  '2年1組','2年2組','2年3組',
  '3年1組','3年2組','3年3組',
  '4年1組','4年2組','4年3組',
  '5年1組','5年2組','5年3組',
  '6年1組','6年2組','6年3組',
  'けやき学級'
];

// ==========================================
// 状態
// ==========================================
const st = {
  rooms:[],priorities:[],bookings:[],
  roomId:null,weekStart:mondayOf(new Date())
};
let activeCell = null;

// ==========================================
// API
// ==========================================
async function api(method, params) {
  if(!API_URL || API_URL.includes('YOUR_DEPLOYMENT_ID')){
    document.getElementById('apiBanner').classList.add('show');
    throw new Error('API_URL未設定');
  }
  if(method === 'GET'){
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(API_URL + (qs ? '?'+qs : ''), {redirect:'follow'});
    return r.json();
  } else {
    const r = await fetch(API_URL, {
      method:'POST', redirect:'follow',
      headers:{'Content-Type':'text/plain'},
      body: JSON.stringify(params)
    });
    return r.json();
  }
}

// ==========================================
// 初期化
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  // セレクト初期化
  const gs = document.getElementById('gradeSel');
  const cs = document.getElementById('classSel');
  [1,2,3,4,5,6].forEach(g=>{ const o=document.createElement('option');o.value=g;o.textContent=g+'年';gs.appendChild(o); });
  [1,2,3].forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c+'組';cs.appendChild(o); });
  const ke=document.createElement('option');ke.value='けやき';ke.textContent='けやき学級';gs.appendChild(ke);

  // 優先時間割モーダル用セレクト
  const ttGs = document.getElementById('ttGradeSel');
  const ttCs = document.getElementById('ttClassSel');
  [1,2,3,4,5,6].forEach(g=>{ const o=document.createElement('option');o.value=g;o.textContent=g+'年';ttGs.appendChild(o); });
  [1,2,3].forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c+'組';ttCs.appendChild(o); });
  const ttKe=document.createElement('option');ttKe.value='けやき';ttKe.textContent='けやき学級';ttGs.appendChild(ttKe);

  // セレクト初期化が失敗していないか確認
  if(!document.getElementById('ttGradeSel')){
    document.getElementById('grid').innerHTML='<div class="loading">エラー: ttGradeSel が見つかりません<\/div>'; return;
  }
  try {
    const d = await api('GET',{action:'init'});
    if(!d.ok) throw new Error('APIエラー: '+d.error);
    st.rooms      = d.rooms      || [];
    st.priorities = d.priorities || [];
    st.bookings   = d.bookings   || [];
    buildRoomList();
    if(st.rooms.length) selectRoom(st.rooms[0].id);
    else document.getElementById('grid').innerHTML='<div class="loading">教室マスタが空です。スプレッドシートを確認してください。<\/div>';
  } catch(e) {
    document.getElementById('grid').innerHTML = '<div class="loading" style="color:#e24b4a">読み込みエラー: '+esc(e.message)+'<\/div>';
    console.error('init error:', e);
  }
});

// ==========================================
// 教室リスト
// ==========================================
function buildRoomList(){
  const el = document.getElementById('roomList');
  el.innerHTML = '';
  st.rooms.forEach(r=>{
    const b = document.createElement('button');
    b.className='room-btn'; b.textContent=r.name; b.dataset.id=r.id;
    b.onclick=()=>selectRoom(r.id);
    el.appendChild(b);
  });
}
function selectRoom(id){
  st.roomId = id;
  document.querySelectorAll('.room-btn').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
  const r = st.rooms.find(x=>x.id===id);
  document.getElementById('roomName').textContent = r ? r.name : '';
  renderCal();
}
// ==========================================
// カレンダー描画
// ==========================================
function renderCal(){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const end = addDays(st.weekStart, 4);
  document.getElementById('weekLbl').textContent =
    st.weekStart.getFullYear()+'年 '+(st.weekStart.getMonth()+1)+'/'+st.weekStart.getDate()+
    ' 〜 '+(end.getMonth()+1)+'/'+end.getDate();

  // ヘッダー
  const ch = document.createElement('div'); ch.className='g-hdr'; grid.appendChild(ch);
  DAYS.forEach((d,i)=>{
    const dt = addDays(st.weekStart,i);
    const el = document.createElement('div'); el.className='g-hdr';
    el.textContent = d+'\n'+(dt.getMonth()+1)+'/'+dt.getDate();
    grid.appendChild(el);
  });

  // 校時行
  PERIODS.forEach(p=>{
    const pl = document.createElement('div'); pl.className='g-per'; pl.textContent=p+'時限'; grid.appendChild(pl);
    DAYS.forEach((_,i)=>{
      const dt  = addDays(st.weekStart,i);
      const ds  = ymd(dt);
      const bks = st.bookings.filter(b=>b.roomId===st.roomId&&b.date===ds&&b.period===p);
      const pris = st.priorities.filter(pr=>pr.roomId===st.roomId&&pr.dayIdx===i&&pr.period===p);
      grid.appendChild(mkCell(ds, p, bks, pris));
    });
  });
}

function mkCell(dateStr, period, bks, pris){
  // bks = この枠の予約配列、pris = この枠の優先クラス配列
  const btn = document.createElement('button');
  btn.className = 'g-cell';
  const room = st.rooms.find(x=>x.id===st.roomId);
  const cap = room ? room.capacity : 1;

  if(bks.length > 0){
    btn.classList.add('booked');
    let html = '';
    // 優先クラスをセル上部にアンバー色で表示（予約があっても消えない）
    if(pris.length > 0){
      const priLabels = pris.map(pr=>esc(pr.label)).join('・');
      html += '<span style="display:block;font-size:10px;color:#854f0b;background:#faeeda;border-radius:3px;padding:1px 4px;margin-bottom:3px;line-height:1.3">優先 '+priLabels+'<\/span>';
    }
    bks.forEach(bk => {
      const ts = bk.updatedAt ? fmtDT(bk.updatedAt)+' · '+esc(bk.teacher) : esc(bk.teacher);
      html += '<span class="cell-cls" data-tip="最終更新 '+ts+'" style="display:block">'+esc(bk.classLabel)+'<\/span>';
      if(bk.teacher) html += '<span class="cell-tchr" style="display:block">'+esc(bk.teacher)+'<\/span>';
    });
    if(bks.length < cap){
      html += '<span style="font-size:11px;color:var(--p600);margin-top:2px;display:block">＋追加<\/span>';
    }
    btn.innerHTML = html;
    const firstTs = bks[0].updatedAt ? fmtDT(bks[0].updatedAt)+' · '+esc(bks[0].teacher) : esc(bks[0].teacher);
    btn.dataset.tip = bks.length > 1
      ? bks.map(b=>esc(b.classLabel)).join(' / ')
      : '最終更新 '+firstTs;
    btn.addEventListener('mouseenter', showTip);
    btn.addEventListener('mousemove',  moveTip);
    btn.addEventListener('mouseleave', hideTip);
  } else if(pris.length > 0){
    btn.classList.add('pri');
    // 複数優先クラスを縦並び
    const html = '<span class="cell-pribadge">優先<\/span>'
      + pris.map(pr=>'<span style="font-size:13px;color:var(--g600);display:block">'+esc(pr.label)+'<\/span>').join('');
    btn.innerHTML = html;
  } else {
    btn.classList.add('empty'); btn.textContent='+';
  }
  btn.onclick = ()=>openModal(dateStr, period, bks, pris);
  return btn;
}

// ==========================================
// ツールチップ
// ==========================================
const tipEl = document.getElementById('tip');
function showTip(e){ tipEl.textContent=e.currentTarget.dataset.tip; tipEl.classList.add('show'); moveTip(e); }
function moveTip(e){ tipEl.style.left=(e.clientX+14)+'px'; tipEl.style.top=(e.clientY-28)+'px'; }
function hideTip(){ tipEl.classList.remove('show'); }

// ==========================================
// モーダル（複数クラス対応）
// ==========================================
function openModal(dateStr, period, bks, pris){
  activeCell = {dateStr, period, bks, pris};
  const r = st.rooms.find(x=>x.id===st.roomId);
  const cap = r ? r.capacity : 1;
  document.getElementById('mTitle').textContent = (r?r.name:'') + ' · ' + period + '校時';
  document.getElementById('mSub').textContent =
    dateStr.slice(0,4)+'/'+dateStr.slice(4,6)+'/'+dateStr.slice(6,8)+
    ' ('+DAYS[getDayIdx(dateStr)]+')';
  document.getElementById('errMsg').style.display='none';

  const hint = document.getElementById('mHint');
  if(pris && pris.length>0){ hint.style.display=''; hint.textContent='⚠ この枠の優先クラス: '+pris.map(p=>p.label).join('、'); }
  else hint.style.display='none';

  // 既存予約リストを描画
  renderBookingList(bks);

  // 定員表示
  document.getElementById('capInfo').textContent = '定員 '+cap+' クラス　現在 '+bks.length+' クラス予約中';

  // 追加フォーム：定員に空きがあれば表示
  const addForm = document.getElementById('addForm');
  if(bks.length < cap){
    addForm.style.display='';
    document.getElementById('gradeSel').value=1;
    document.getElementById('classSel').value=1;
    document.getElementById('teacherIn').value='';
    document.getElementById('saveBtn').textContent='予約する';
  } else {
    addForm.style.display='none';
  }
  document.getElementById('lastEdit').style.display='none';
  document.getElementById('modalBg').classList.add('show');
  setTimeout(()=>{if(bks.length<cap)document.getElementById('teacherIn').focus();},50);
}

function renderBookingList(bks){
  const ul = document.getElementById('bookingList');
  ul.innerHTML='';
  if(!bks.length){ ul.innerHTML='<li style="color:var(--text3);font-size:12px;padding:4px 0">予約なし<\/li>'; return; }
  bks.forEach(bk=>{
    const li = document.createElement('li');
    li.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:.5px solid var(--border);font-size:13px';
    const ns=document.createElement('span'); ns.style.cssText='font-weight:500;flex:1'; ns.textContent=bk.classLabel;
    const ts=document.createElement('span'); ts.style.cssText='color:var(--text3);font-size:11px'; ts.textContent=bk.teacher||'';
    const db=document.createElement('button'); db.className='danger'; db.style.cssText='padding:3px 8px;font-size:11px'; db.textContent='取消';
    db.addEventListener('click',()=>doDelete(bk.id));
    li.appendChild(ns); li.appendChild(ts); li.appendChild(db); ul.appendChild(li);
  });
}

function closeModal(){ document.getElementById('modalBg').classList.remove('show'); activeCell=null; }

function saveBooking(){
  const cell = activeCell;
  if(!cell) return;
  const teacher = document.getElementById('teacherIn').value.trim();
  if(!teacher){ document.getElementById('errMsg').style.display=''; document.getElementById('teacherIn').focus(); return; }
  const classLabel = buildLabel();
  const roomId = st.roomId;

  // 楽観的更新: 即座に画面反映
  const tmpId = 'tmp_'+Date.now();
  const newBk = {id:tmpId,roomId,date:cell.dateStr,period:cell.period,classLabel,teacher,updatedAt:Date.now()};
  const prevBks = getBks(roomId,cell.dateStr,cell.period);
  const sameIdx = prevBks.findIndex(b=>b.classLabel===classLabel);
  let replaced = null;
  if(sameIdx>=0){ replaced=prevBks[sameIdx]; st.bookings=st.bookings.filter(b=>b.id!==replaced.id); }
  st.bookings.push(newBk);
  if(activeCell){ activeCell.bks=getBks(roomId,cell.dateStr,cell.period); renderBookingList(activeCell.bks); }
  const r0=st.rooms.find(x=>x.id===roomId); const cap0=r0?r0.capacity:1;
  document.getElementById('capInfo').textContent='定員 '+cap0+' クラス　現在 '+getBks(roomId,cell.dateStr,cell.period).length+' クラス予約中';
  if(getBks(roomId,cell.dateStr,cell.period).length>=cap0) document.getElementById('addForm').style.display='none';
  document.getElementById('teacherIn').value='';
  renderCal();

  // バックグラウンドでGASに保存
  api('POST',{action:'saveBooking',roomId,dateStr:cell.dateStr,period:cell.period,classLabel,teacher})
    .then(res=>{
      if(!res.ok){
        st.bookings=st.bookings.filter(b=>b.id!==tmpId);
        if(replaced) st.bookings.push(replaced);
        if(activeCell){ activeCell.bks=getBks(roomId,cell.dateStr,cell.period); renderBookingList(activeCell.bks); }
        renderCal(); showToast('保存に失敗しました: '+res.error,true);
      } else { showToast('予約しました'); }
    })
    .catch(e=>showToast('通信エラー: '+e.message,true));
}

function doDelete(bookingId){
  if(!confirm('この予約を取消しますか？')) return;
  const teacher = document.getElementById('teacherIn').value.trim()||'(不明)';
  const roomId = st.roomId;

  // 楽観的更新: 即座に削除
  const prevBk = st.bookings.find(b=>b.id===bookingId);
  st.bookings = st.bookings.filter(b=>b.id!==bookingId);
  if(activeCell){
    activeCell.bks=getBks(roomId,activeCell.dateStr,activeCell.period);
    renderBookingList(activeCell.bks);
    const r1=st.rooms.find(x=>x.id===roomId); const cap1=r1?r1.capacity:1;
    document.getElementById('capInfo').textContent='定員 '+cap1+' クラス　現在 '+activeCell.bks.length+' クラス予約中';
    if(activeCell.bks.length<cap1) document.getElementById('addForm').style.display='';
  }
  renderCal();

  // バックグラウンドでGASに保存
  api('POST',{action:'deleteBooking',bookingId,teacher})
    .then(res=>{
      if(!res.ok){
        if(prevBk) st.bookings.push(prevBk);
        if(activeCell){ activeCell.bks=getBks(roomId,activeCell.dateStr,activeCell.period); renderBookingList(activeCell.bks); }
        renderCal(); showToast('取消に失敗しました: '+res.error,true);
      } else { showToast('予約を取消しました'); }
    })
    .catch(e=>showToast('通信エラー: '+e.message,true));
}
// 同じ枠の予約を返す
function getBks(roomId, dateStr, period){
  return st.bookings.filter(b=>b.roomId===roomId&&b.date===dateStr&&b.period===period);
}
// ==========================================
// 優先クラス
// ==========================================
function removePriority(roomId,dayIdx,period,label){
  // 楽観的更新
  const prev=st.priorities.find(p=>p.roomId===roomId&&p.dayIdx===dayIdx&&p.period===period&&p.label===label);
  st.priorities=st.priorities.filter(p=>!(p.roomId===roomId&&p.dayIdx===dayIdx&&p.period===period&&p.label===label));
  // カードを再描画
  const card=document.getElementById('tt-card-'+roomId);
  if(card){const r=st.rooms.find(x=>x.id===roomId);if(r)card.innerHTML=buildTtCard(r);}
  if(st.roomId===roomId) renderCal();

  api('POST',{action:'deletePriority',roomId,dayIdx,period,label})
    .then(res=>{
      if(!res.ok){
        if(prev) st.priorities.push(prev);
        const card2=document.getElementById('tt-card-'+roomId);
        if(card2){const r2=st.rooms.find(x=>x.id===roomId);if(r2)card2.innerHTML=buildTtCard(r2);}
        if(st.roomId===roomId) renderCal();
        showToast('削除に失敗しました: '+res.error,true);
      } else { showToast('優先クラスを削除しました'); }
    })
    .catch(e=>showToast('通信エラー: '+e.message,true));
}

// トースト通知
let toastTimer = null;
function showToast(msg, isError=false){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = [
      'position:fixed','bottom:24px','left:50%','transform:translateX(-50%)',
      'padding:9px 18px','border-radius:20px','font-size:13px',
      'z-index:9999','pointer-events:none','transition:opacity .3s',
      'white-space:nowrap','box-shadow:0 2px 12px rgba(0,0,0,.15)'
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = isError ? '#e24b4a' : '#26215c';
  t.style.color = '#fff';
  t.style.opacity = '1';
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.style.opacity='0'; }, 2500);
}

// ==========================================
// 週ナビ
// ==========================================
function shiftWeek(n){ st.weekStart=addDays(st.weekStart,n*7); loadWeek(); }
function goToday(){ st.weekStart=mondayOf(new Date()); loadWeek(); }
async function loadWeek(){
  try{
    const d = await api('GET',{action:'weekBookings',monday:ymd(st.weekStart)});
    if(!d.ok) throw new Error(d.error);
    const ds=ymd(st.weekStart), de=ymd(addDays(st.weekStart,5));
    st.bookings = st.bookings.filter(b=>b.date<ds||b.date>=de).concat(d.bookings);
    renderCal();
  } catch(e){ alert('通信エラー: '+e.message); }
}

// ==========================================
// タブ
// ==========================================
function switchTab(t){
  document.getElementById('calPanel').style.display = t==='cal'?'':'none';
  document.getElementById('ttPanel').classList.toggle('show', t==='tt');
  document.getElementById('tabCal').classList.toggle('active', t==='cal');
  document.getElementById('tabTt').classList.toggle('active', t==='tt');
  if(t==='tt') renderTimetable();
}

// ==========================================
// 優先時間割（セルから直接登録・削除）
// ==========================================
const DAYS_TT    = ['月','火','水','木','金'];
const PERIODS_TT = [1,2,3,4,5,6];
let activeTtCell = null; // {roomId, roomName, dayIdx, period, cap}

function renderTimetable(){
  const nav  = document.getElementById('ttNav');
  const grid = document.getElementById('ttGrid');
  nav.innerHTML=''; grid.innerHTML='';

  const withPri    = st.rooms.filter(r=>st.priorities.some(p=>p.roomId===r.id));
  const withoutPri = st.rooms.filter(r=>!st.priorities.some(p=>p.roomId===r.id));
  const orderedRooms = [...withPri,...withoutPri];

  orderedRooms.forEach(room=>{
    // ナビボタン
    const navBtn = document.createElement('button');
    navBtn.className='tt-nav-btn'; navBtn.textContent=room.name; navBtn.dataset.roomId=room.id;
    navBtn.onclick=()=>scrollToCard(room.id);
    nav.appendChild(navBtn);

    // カード（テーブルをJSで組む）
    const card = document.createElement('div');
    card.className='tt-card'; card.id='tt-card-'+room.id;
    card.innerHTML = buildTtCard(room);
    // tt-cellのクリックをイベント委譲で処理
    card.addEventListener('click', function(e){
      const td = e.target.closest('.tt-cell');
      if(!td) return;
      openTtModal(td.dataset.roomId, td.dataset.roomName, Number(td.dataset.day), Number(td.dataset.period), Number(td.dataset.cap));
    });
    grid.appendChild(card);
  });

  setupTtObserver();
}

function buildTtCard(room){
  const priMap={};
  st.priorities.filter(p=>p.roomId===room.id).forEach(p=>{
    const k=p.dayIdx+'_'+p.period;
    if(!priMap[k]) priMap[k]=[];
    priMap[k].push(p.label);
  });

  let html =
    '<div class="tt-card-hdr">'+
    '<i class="ti ti-building" style="font-size:15px;color:var(--text3)" aria-hidden="true"><\/i>'+
    '<span class="tt-card-name">'+esc(room.name)+'<\/span>'+
    (room.capacity>1?'<span class="tt-card-cap">定員 '+room.capacity+' クラス<\/span>':'')+
    '<\/div>'+
    '<div style="overflow-x:auto"><table class="tt-tbl">'+
    '<thead><tr><th class="tt-per"><\/th>';
  DAYS_TT.forEach(d=>{ html+='<th>'+d+'<\/th>'; });
  html+='<\/tr><\/thead><tbody>';

  PERIODS_TT.forEach(p=>{
    html+='<tr><td class="tt-per">'+p+'時限<\/td>';
    for(let d=0;d<5;d++){
      const k=d+'_'+p;
      const labels=priMap[k]||[];
      const isFull = labels.length>=room.capacity;
      // クリックで編集モーダルを開く
      html+='<td class="tt-cell" style="cursor:pointer;transition:background .1s" data-room-id="'+room.id+'" data-room-name="'+esc(room.name)+'" data-day="'+d+'" data-period="'+p+'" data-cap="'+room.capacity+'">';
      if(labels.length>0){
        labels.forEach(l=>{
          html+='<span class="tt-badge" style="display:block;margin:1px 0">'+esc(l)+'<\/span>';
        });
        if(!isFull) html+='<span style="font-size:10px;color:var(--p600);display:block;margin-top:2px">＋追加<\/span>';
      } else {
        html+='<span class="tt-empty" style="font-size:16px">+<\/span>';
      }
      html+='<\/td>';
    }
    html+='<\/tr>';
  });
  html+='<\/tbody><\/table><\/div>';
  return html;
}

// 優先クラス編集モーダルを開く
function openTtModal(roomId,roomName,dayIdx,period,cap){
  activeTtCell={roomId,roomName,dayIdx,period,cap};
  document.getElementById('ttMTitle').textContent=roomName+' · '+period+'校時';
  document.getElementById('ttMSub').textContent=DAYS_TT[dayIdx]+'曜日';
  document.getElementById('ttErrMsg').style.display='none';
  document.getElementById('ttGradeSel').value=1;
  document.getElementById('ttClassSel').value=1;
  renderTtPriList();
  document.getElementById('ttModalBg').classList.add('show');
}
function closeTtModal(){
  document.getElementById('ttModalBg').classList.remove('show');
  activeTtCell=null;
}

function renderTtPriList(){
  const c=activeTtCell; if(!c) return;
  const ul=document.getElementById('ttPriList');
  const current=st.priorities.filter(p=>p.roomId===c.roomId&&p.dayIdx===c.dayIdx&&p.period===c.period);
  const isFull=current.length>=c.cap;
  document.getElementById('ttMCap').textContent='定員 '+c.cap+' クラス　現在 '+current.length+' クラス登録中';
  document.getElementById('ttAddForm').style.display=isFull?'none':'';
  ul.innerHTML='';
  if(!current.length){
    ul.innerHTML='<li style="color:var(--text3);font-size:12px;padding:4px 0">登録なし<\/li>';
    return;
  }
  current.forEach(p=>{
    const li=document.createElement('li');
    li.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:.5px solid var(--border);font-size:13px';
    const ns=document.createElement('span');
    ns.style.cssText='font-weight:500;flex:1';
    ns.textContent=p.label;
    const db=document.createElement('button');
    db.className='danger';
    db.style.cssText='padding:3px 10px;font-size:12px';
    db.textContent='削除';
    db.addEventListener('click',()=>ttRemovePriority(p.roomId,p.dayIdx,p.period,p.label));
    li.appendChild(ns); li.appendChild(db); ul.appendChild(li);
  });
}

function saveTtPriority(){
  const c=activeTtCell; if(!c) return;
  const g=document.getElementById('ttGradeSel').value;
  const cl=document.getElementById('ttClassSel').value;
  const label=g==='けやき'?'けやき学級':g+'年'+cl+'組';
  // 重複チェック
  if(st.priorities.find(p=>p.roomId===c.roomId&&p.dayIdx===c.dayIdx&&p.period===c.period&&p.label===label)){
    document.getElementById('ttErrMsg').textContent='同じクラスが既に登録されています';
    document.getElementById('ttErrMsg').style.display='';
    return;
  }
  addPriorityDirect(c.roomId,c.dayIdx,c.period,label);
}

function ttRemovePriority(roomId,dayIdx,period,label){
  removePriority(roomId,dayIdx,period,label);
  // モーダルが開いていれば更新
  if(activeTtCell&&activeTtCell.roomId===roomId&&activeTtCell.dayIdx===dayIdx&&activeTtCell.period===period){
    renderTtPriList();
  }
}

// addPriorityの共通ロジック（直接呼び出し用）
function addPriorityDirect(roomId,dayIdx,period,label){
  const room=st.rooms.find(r=>r.id===roomId);
  const cap=room?room.capacity:1;
  const current=st.priorities.filter(p=>p.roomId===roomId&&p.dayIdx===dayIdx&&p.period===period);
  if(current.length>=cap){ showToast('定員（'+cap+'クラス）に達しています',true); return; }
  // 楽観的更新
  st.priorities.push({roomId,dayIdx,period,label});
  renderTtPriList();
  // カードだけ再描画（全体renderTimetableは重いので対象カードのみ）
  const card=document.getElementById('tt-card-'+roomId);
  if(card){ const r=st.rooms.find(x=>x.id===roomId); if(r) card.innerHTML=buildTtCard(r); }
  if(st.roomId===roomId) renderCal();
  // API保存
  api('POST',{action:'setPriority',roomId,dayIdx,period,label})
    .then(res=>{
      if(!res.ok){
        st.priorities=st.priorities.filter(p=>!(p.roomId===roomId&&p.dayIdx===dayIdx&&p.period===period&&p.label===label));
        renderTtPriList();
        const card2=document.getElementById('tt-card-'+roomId);
        if(card2){const r2=st.rooms.find(x=>x.id===roomId);if(r2)card2.innerHTML=buildTtCard(r2);}
        showToast('保存に失敗しました: '+res.error,true);
      } else { showToast('優先クラスを登録しました'); }
    })
    .catch(e=>showToast('通信エラー: '+e.message,true));
}

function scrollToCard(roomId){
  const card=document.getElementById('tt-card-'+roomId); if(!card) return;
  const top=card.getBoundingClientRect().top+window.scrollY-120;
  window.scrollTo({top,behavior:'smooth'});
  setNavActive(roomId);
}
function setNavActive(roomId){
  document.querySelectorAll('.tt-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.roomId===roomId));
}
let ttObserver=null;
function setupTtObserver(){
  if(ttObserver) ttObserver.disconnect();
  ttObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{ if(entry.isIntersecting) setNavActive(entry.target.id.replace('tt-card-','')); });
  },{rootMargin:'-120px 0px -60% 0px',threshold:0});
  document.querySelectorAll('.tt-card').forEach(c=>ttObserver.observe(c));
}

// ==========================================
// ユーティリティ
// ==========================================
function buildLabel(){
  const g=document.getElementById('gradeSel').value;
  const c=document.getElementById('classSel').value;
  return g==='けやき'?'けやき学級':g+'年'+c+'組';
}
function parseLabel(label){
  const g=document.getElementById('gradeSel'), c=document.getElementById('classSel');
  if(label==='けやき学級'){g.value='けやき';c.value=1;return;}
  const m=label.match(/^(\d)年(\d)組$/);
  if(m){g.value=m[1];c.value=m[2];}
}
function mondayOf(d){
  const x=new Date(d);x.setHours(0,0,0,0);
  const day=x.getDay();x.setDate(x.getDate()+(day===0?-6:1-day));return x;
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function ymd(d){return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');}
function getDayIdx(ds){const d=new Date(+ds.slice(0,4),+ds.slice(4,6)-1,+ds.slice(6,8));const day=d.getDay();return day===0?6:day-1;}
function fmtDT(ts){const d=new Date(ts);return(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function esc(s){var m={'&':'&amp;','\x3c':'&lt;','\x3e':'&gt;','\x22':'&quot;','\x27':'&#39;'};return String(s).split('').map(function(c){return m[c]||c;}).join('');}
