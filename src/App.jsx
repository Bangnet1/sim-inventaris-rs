import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { Activity, Archive, BarChart3, Building2, Camera, ClipboardCheck, Clock3, LayoutDashboard, LogOut, Menu, Package, Search, Settings, ShieldCheck, Users, X, Plus, Pencil, ChevronDown, AlertCircle, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';

const nav = [
  ['Dashboard',LayoutDashboard],['Monitoring Shift',ClipboardCheck],['Data Inventaris',Package],['Lantai & Ruangan',Building2],['Barang Dipinjam',Archive],['Riwayat Monitoring',Clock3],['Laporan',BarChart3],['Petugas',Users],['Manajemen Akun',ShieldCheck]
];
const fmt = n => new Intl.NumberFormat('id-ID').format(n || 0);
async function compressMonitoringPhoto(file){
  const bitmap=await createImageBitmap(file);
  try{
    let width=bitmap.width,height=bitmap.height;
    const maxSide=1600,scale=Math.min(1,maxSide/Math.max(width,height));
    width=Math.round(width*scale);height=Math.round(height*scale);
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Browser tidak mendukung kompresi foto.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
    ctx.drawImage(bitmap,0,0,width,height);
    const toBlob=quality=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Gagal memproses foto.')),'image/jpeg',quality));
    let quality=0.82,blob=await toBlob(quality);
    while(blob.size>450*1024&&quality>0.55){quality-=0.08;blob=await toBlob(quality);}
    if(blob.size>450*1024){
      const ratio=Math.sqrt((450*1024)/blob.size)*0.92;
      const w=Math.max(720,Math.round(canvas.width*ratio)),h=Math.max(720,Math.round(canvas.height*ratio));
      const smaller=document.createElement('canvas');smaller.width=w;smaller.height=h;
      const sctx=smaller.getContext('2d',{alpha:false});
      sctx.fillStyle='#fff';sctx.fillRect(0,0,w,h);sctx.drawImage(canvas,0,0,w,h);
      blob=await new Promise((resolve,reject)=>smaller.toBlob(b=>b?resolve(b):reject(new Error('Gagal mengoptimalkan ukuran foto.')),'image/jpeg',0.68));
    }
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'-compressed.jpg',{type:'image/jpeg',lastModified:Date.now()});
  }finally{bitmap.close?.();}
}

function App(){
  const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[page,setPage]=useState(()=>{const valid=['Dashboard','Monitoring Shift','Data Inventaris','Lantai & Ruangan','Barang Dipinjam','Riwayat Monitoring','Laporan','Petugas','Manajemen Akun'];try{const fromHash=decodeURIComponent(window.location.hash.replace(/^#/,''));const saved=localStorage.getItem('sim-inventaris-rs:last-page');return valid.includes(fromHash)?fromHash:(valid.includes(saved)?saved:'Dashboard');}catch{return 'Dashboard';}}),[mobile,setMobile]=useState(false);
  const [items,setItems]=useState([]),[floors,setFloors]=useState([]),[rooms,setRooms]=useState([]),[records,setRecords]=useState([]),[sessions,setSessions]=useState([]),[returns,setReturns]=useState([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[showLoginPassword,setShowLoginPassword]=useState(false),[showNewUserPassword,setShowNewUserPassword]=useState(false),[recoveryMode,setRecoveryMode]=useState(false),[recoveryPassword,setRecoveryPassword]=useState(''),[recoveryMessage,setRecoveryMessage]=useState('');
  const [users,setUsers]=useState([]),[newUser,setNewUser]=useState({email:'',password:'',full_name:'',role:'officer'}),[creatingUser,setCreatingUser]=useState(false),[userMessage,setUserMessage]=useState('');
  const [search,setSearch]=useState(''),[inventoryFilters,setInventoryFilters]=useState({name:'',category:'',location:'',status:''}),[showAdd,setShowAdd]=useState(false),[newItem,setNewItem]=useState({asset_code:'',name:'',category:'Umum',floor_id:'',notes:''});
  const [historyFilters,setHistoryFilters]=useState({from:'',to:'',item:'',floor:'',shift:'',staff:''});
  const [photoPreview,setPhotoPreview]=useState(null),[photoLoading,setPhotoLoading]=useState(''),[returnNotes,setReturnNotes]=useState({}),[returningRecord,setReturningRecord]=useState('');
  const [newFloorName,setNewFloorName]=useState(''),[roomNames,setRoomNames]=useState({}),[addingFloor,setAddingFloor]=useState(false),[addingRoom,setAddingRoom]=useState({});
  const [monitor,setMonitor]=useState({floor_id:'',shift:'Pagi'}),[checkPhotos,setCheckPhotos]=useState({}),[checkStatuses,setCheckStatuses]=useState({}),[checkNotes,setCheckNotes]=useState({}),[savingItem,setSavingItem]=useState('');
  useEffect(()=>{ if(!supabase){setLoading(false);return;} supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY'){setRecoveryMode(true);setRecoveryMessage('');setError('');}}); return ()=>subscription.unsubscribe(); },[]);
  useEffect(()=>{try{localStorage.setItem('sim-inventaris-rs:last-page',page);}catch{}try{const target='#'+encodeURIComponent(page);if(window.location.hash!==target)window.history.replaceState(null,'',target);}catch{}},[page]);
  useEffect(()=>{ if(session?.user) loadAll(); else {setProfile(null);setLoading(false);} },[session]);
  async function loadAll(){
    setLoading(true);setError('');
    try{
      const [p,i,f,rm,r,s,ret]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',session.user.id).single(),
        supabase.from('inventory_items').select('*, floors(name)').eq('is_active',true).order('name'),
        supabase.from('floors').select('*').eq('is_active',true).order('sort_order'),
        supabase.from('rooms').select('*, floors(name)').eq('is_active',true).order('name'),
        supabase.from('monitoring_records').select('*, inventory_items(name,asset_code), monitoring_sessions(monitoring_date,shift,floor_id,floors(name)), profiles!monitoring_records_recorded_by_profile_fkey(full_name)').order('recorded_at',{ascending:false}).limit(1000),
        supabase.from('monitoring_sessions').select('*, floors(name)').order('started_at',{ascending:false}).limit(30),
        supabase.from('inventory_returns').select('*').order('returned_at',{ascending:false})
      ]);
      if(p.error) throw p.error; if(i.error) throw i.error; if(f.error) throw f.error;
      setProfile(p.data);setItems(i.data||[]);setFloors(f.data||[]);setRooms(rm.data||[]);setRecords(r.data||[]);setSessions(s.data||[]);setReturns(ret.data||[]);
      if(p.data?.role==='super_admin'){const {data:accountRows,error:accountError}=await supabase.from('profiles').select('id,full_name,role,created_at').order('created_at',{ascending:false});if(accountError)throw accountError;setUsers(accountRows||[]);}else{setUsers([]);if(page==='Manajemen Akun')setPage('Dashboard');}
    }catch(e){setError(e.message||'Gagal memuat data');}finally{setLoading(false);}
  }
  async function signIn(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setBusy(false);}\n  async function requestPasswordReset(){if(!email.trim()){setError('Masukkan email akun terlebih dahulu.');return;}setBusy(true);setError('');setRecoveryMessage('');const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(error)setError(error.message);else setRecoveryMessage('Jika email terdaftar, tautan reset password akan dikirim. Periksa kotak masuk dan folder spam.');setBusy(false);}\n  async function updateRecoveredPassword(e){e.preventDefault();if(recoveryPassword.length<8){setError('Password minimal 8 karakter.');return;}setBusy(true);setError('');const {error}=await supabase.auth.updateUser({password:recoveryPassword});if(error)setError(error.message);else{setRecoveryMode(false);setRecoveryPassword('');setRecoveryMessage('Password berhasil diperbarui. Silakan masuk menggunakan password baru.');await supabase.auth.signOut();}setBusy(false);}
  async function createManagedUser(e){e.preventDefault();if(profile?.role!=='super_admin')return;setCreatingUser(true);setUserMessage('');setError('');try{const {data,error}=await supabase.functions.invoke('admin-create-user',{body:newUser});if(error)throw error;if(data?.error)throw new Error(data.error);setUserMessage('Akun '+data.user.email+' berhasil dibuat. Pengguna dapat langsung login.');setNewUser({email:'',password:'',full_name:'',role:'officer'});await loadAll();}catch(e){setError(e.message||'Gagal membuat akun. Pastikan layanan admin-create-user sudah aktif.');}finally{setCreatingUser(false);}}
  async function addItem(e){e.preventDefault();setBusy(true);const {error}=await supabase.from('inventory_items').insert({...newItem,created_by:session.user.id});if(error)setError(error.message);else{setShowAdd(false);setNewItem({asset_code:'',name:'',category:'Umum',floor_id:'',notes:''});await loadAll();}setBusy(false);}
  const canManageLocations=['super_admin','inventory_admin'].includes(profile?.role);
  async function addFloor(e){
    e.preventDefault(); if(!newFloorName.trim())return;
    setAddingFloor(true);setError('');
    const {error}=await supabase.from('floors').insert({name:newFloorName.trim(),sort_order:floors.length+1});
    if(error)setError(error.message);else{setNewFloorName('');await loadAll();}
    setAddingFloor(false);
  }
  async function editFloor(floor){
    const next=window.prompt('Ubah nama lantai:',floor.name);
    if(next===null)return;
    const name=next.trim();if(!name||name===floor.name)return;
    setError('');
    const {error}=await supabase.from('floors').update({name}).eq('id',floor.id);
    if(error)setError(error.message);else await loadAll();
  }
  async function deleteFloor(floor){
    const [roomRes,itemRes,sessionRes]=await Promise.all([
      supabase.from('rooms').select('id').eq('floor_id',floor.id),
      supabase.from('inventory_items').select('id').eq('floor_id',floor.id),
      supabase.from('monitoring_sessions').select('id').eq('floor_id',floor.id)
    ]);
    if(roomRes.error||itemRes.error||sessionRes.error){setError(roomRes.error?.message||itemRes.error?.message||sessionRes.error?.message);return;}
    const counts=(roomRes.data?.length||0)+(itemRes.data?.length||0)+(sessionRes.data?.length||0);
    if(counts){setError('Lantai tidak dapat dihapus karena masih memiliki ruangan, inventaris, atau riwayat monitoring. Pindahkan atau arsipkan data terkait terlebih dahulu.');return;}
    if(!window.confirm('Hapus '+floor.name+'?'))return;
    const {error}=await supabase.from('floors').delete().eq('id',floor.id);
    if(error)setError(error.message);else await loadAll();
  }
  async function addRoom(floorId){
    const name=(roomNames[floorId]||'').trim();if(!name)return;
    setAddingRoom(v=>({...v,[floorId]:true}));setError('');
    const {error}=await supabase.from('rooms').insert({floor_id:floorId,name});
    if(error)setError(error.message);else{setRoomNames(v=>({...v,[floorId]:''}));await loadAll();}
    setAddingRoom(v=>({...v,[floorId]:false}));
  }
  async function editRoom(room){
    const next=window.prompt('Ubah nama ruangan:',room.name);
    if(next===null)return;
    const name=next.trim();if(!name||name===room.name)return;
    setError('');
    const {error}=await supabase.from('rooms').update({name}).eq('id',room.id);
    if(error)setError(error.message);else await loadAll();
  }
  async function deleteRoom(room){
    const {data:used,error:checkError}=await supabase.from('inventory_items').select('id').eq('room_id',room.id).limit(1);
    if(checkError){setError(checkError.message);return;}
    if(used?.length){setError('Ruangan masih digunakan oleh inventaris. Pindahkan inventaris ke ruangan lain terlebih dahulu.');return;}
    if(!window.confirm('Hapus ruangan '+room.name+'?'))return;
    const {error}=await supabase.from('rooms').delete().eq('id',room.id);
    if(error)setError(error.message);else await loadAll();
  }

  function localDateString(){
    const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  const today=localDateString();
  const completedForSelection=records.filter(r=>r.monitoring_sessions?.monitoring_date===today&&r.monitoring_sessions?.floor_id===monitor.floor_id&&r.monitoring_sessions?.shift===monitor.shift);
  const completedIds=new Set(completedForSelection.map(r=>r.inventory_item_id));
  const checklistItems=items.filter(x=>x.floor_id===monitor.floor_id);
  const pendingItems=checklistItems.filter(x=>!completedIds.has(x.id));
  async function saveMonitoringItem(item){
    const photo=checkPhotos[item.id],status=checkStatuses[item.id]||'present',notes=checkNotes[item.id]||'';
    if(!photo){setError('Pilih foto bukti untuk '+item.name+' terlebih dahulu.');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(photo.type)){setError('Format foto harus JPG, PNG, atau WEBP.');return;}
    if(photo.size>10*1024*1024){setError('Ukuran foto maksimal 10 MB.');return;}
    if(status==='borrowed'&&!notes.trim()){setError('Isi nama peminjam pada catatan untuk barang yang dipinjam.');return;}
    setSavingItem(item.id);setError('');
    try{
      let sess=sessions.find(x=>x.floor_id===monitor.floor_id&&x.monitoring_date===today&&x.shift===monitor.shift&&x.status==='draft'&&x.started_by===session.user.id);
      if(!sess){
        const {data,error}=await supabase.from('monitoring_sessions').insert({floor_id:monitor.floor_id,shift:monitor.shift,started_by:session.user.id,started_by_name_snapshot:profile?.full_name||session.user.email,started_by_email_snapshot:session.user.email}).select().single();
        if(error)throw new Error('Gagal membuat sesi: '+error.message);
        sess=data;
      }
      const originalSize=photo.size;
      let compressedPhoto;
      try{compressedPhoto=await compressMonitoringPhoto(photo);}catch(compressError){throw new Error('Kompresi foto gagal: '+compressError.message);}
      const path=session.user.id+'/'+sess.id+'/'+item.id+'-'+Date.now()+'.jpg';
      const up=await supabase.storage.from('monitoring-photos').upload(path,compressedPhoto,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
      if(up.error)throw new Error('Upload foto gagal: '+up.error.message);
      const {error}=await supabase.from('monitoring_records').insert({session_id:sess.id,inventory_item_id:item.id,item_name_snapshot:item.name,asset_code_snapshot:item.asset_code,status,photo_path:path,notes,borrowed_to:status==='borrowed'?notes:null,recorded_by:session.user.id,recorded_by_name_snapshot:profile?.full_name||session.user.email,recorded_by_email_snapshot:session.user.email});
      if(error)throw new Error('Foto terunggah tetapi catatan gagal disimpan: '+error.message);
      setCheckPhotos(v=>{const n={...v};delete n[item.id];return n;});
      setCheckNotes(v=>({...v,[item.id]:''}));
      await loadAll();
      const savedKb=Math.round(compressedPhoto.size/1024),originalKb=Math.round(originalSize/1024);
      setError('Monitoring '+item.name+' berhasil disimpan. Ukuran foto '+originalKb+' KB → '+savedKb+' KB.');
    }catch(e){setError(e.message||'Gagal menyimpan monitoring.');}
    finally{setSavingItem('');}
  }
  async function markItemReturned(record){
    if(!window.confirm('Konfirmasi bahwa '+record.item_name_snapshot+' sudah dikembalikan?'))return;
    setReturningRecord(record.id);setError('');
    try{
      const {error}=await supabase.from('inventory_returns').insert({monitoring_record_id:record.id,inventory_item_id:record.inventory_item_id,returned_by:session.user.id,returned_by_name_snapshot:profile?.full_name||session.user.email,returned_by_email_snapshot:session.user.email,notes:(returnNotes[record.id]||'').trim()||null});
      if(error)throw error;
      setReturnNotes(v=>({...v,[record.id]:''}));
      await loadAll();
      setError('Pengembalian '+record.item_name_snapshot+' berhasil dicatat.');
    }catch(e){setError(e.message||'Gagal mencatat pengembalian barang.');}
    finally{setReturningRecord('');}
  }
  async function viewMonitoringPhoto(record){
    if(!record.photo_path){setError('Foto bukti tidak tersedia pada catatan monitoring ini.');return;}
    setPhotoLoading(record.id);setError('');
    try{
      const {data,error}=await supabase.storage.from('monitoring-photos').createSignedUrl(record.photo_path,300);
      if(error)throw error;
      setPhotoPreview({url:data.signedUrl,title:record.item_name_snapshot||'Foto monitoring',date:new Date(record.recorded_at).toLocaleString('id-ID')});
    }catch(e){setError('Foto tidak dapat dibuka: '+(e.message||'Periksa izin Storage Supabase.'));}
    finally{setPhotoLoading('');}
  }
  const historyOptions={items:[...new Set(records.map(r=>r.item_name_snapshot).filter(Boolean))].sort(),floors:[...new Set(records.map(r=>r.monitoring_sessions?.floors?.name).filter(Boolean))].sort(),shifts:[...new Set(records.map(r=>r.monitoring_sessions?.shift).filter(Boolean))].sort(),staff:[...new Set(records.map(r=>r.profiles?.full_name||r.recorded_by_name_snapshot).filter(Boolean))].sort()};
  const filteredHistory=records.filter(r=>{
    const d=new Date(r.recorded_at),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const f=historyFilters;
    return (!f.from||date>=f.from)&&(!f.to||date<=f.to)&&(!f.item||r.item_name_snapshot===f.item)&&(!f.floor||r.monitoring_sessions?.floors?.name===f.floor)&&(!f.shift||r.monitoring_sessions?.shift===f.shift)&&(!f.staff||(r.profiles?.full_name||r.recorded_by_name_snapshot||'')===f.staff);
  });
  const latestByItem=useMemo(()=>{const m={};records.forEach(r=>{if(!m[r.inventory_item_id])m[r.inventory_item_id]=r;});return m;},[records]);
  const stats=useMemo(()=>{const vals=Object.values(latestByItem);const isReturned=x=>x.status==='borrowed'&&returns.some(ret=>ret.monitoring_record_id===x.id);return {present:vals.filter(x=>x.status==='present'||isReturned(x)).length,missing:vals.filter(x=>x.status==='missing').length,borrowed:vals.filter(x=>x.status==='borrowed'&&!isReturned(x)).length,unchecked:Math.max(0,items.length-vals.length)};},[items,latestByItem,returns]);
  const filtered=items.filter(x=>{const latest=latestByItem[x.id];const status=returns.some(ret=>ret.monitoring_record_id===latest?.id)?'present':(latest?.status||'unchecked');return (x.name+' '+x.asset_code+' '+(x.floors?.name||'')).toLowerCase().includes(search.toLowerCase())&&(!inventoryFilters.name||x.name===inventoryFilters.name)&&(!inventoryFilters.category||x.category===inventoryFilters.category)&&(!inventoryFilters.location||x.floors?.name===inventoryFilters.location)&&(!inventoryFilters.status||status===inventoryFilters.status);});
  if(!supabase)return <div className="setup"><div className="login-card"><div className="brand-mark"><ShieldCheck/></div><h1>SIM Inventaris RS</h1><p>Konfigurasi Supabase belum ditemukan.</p><p>Buat file <code>.env</code> dari <code>.env.example</code>, isi URL dan publishable key, lalu jalankan ulang aplikasi.</p></div></div>;
  if(recoveryMode)return <div className="setup"><form className="login-card" onSubmit={updateRecoveredPassword}><div className="brand-mark"><ShieldCheck/></div><span className="eyebrow">PEMULIHAN AKUN</span><h1>Buat password baru</h1><p className="muted">Masukkan password baru untuk akun Super Admin.</p><label>Password baru</label><input type="password" required minLength="8" value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)} placeholder="Minimal 8 karakter"/>{error&&<div className="notice"><AlertCircle size={16}/>{error}</div>}<button className="primary full" disabled={busy}>{busy?'Menyimpan…':'Simpan password baru'}</button></form></div>;\n   if(!session)return <div className="setup"><form className="login-card" onSubmit={signIn}><div className="brand-mark"><ShieldCheck/></div><span className="eyebrow">SISTEM INFORMASI RUMAH SAKIT</span><h1>SIM Inventaris RS</h1><p className="muted">Monitoring inventaris yang tertib, akurat, dan terdokumentasi.</p><label>Email petugas</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@rumahsakit.id"/><label>Password</label><div className="password-field"><input type={showLoginPassword?"text":"password"} required minLength="6" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password"/><button type="button" className="password-toggle" onClick={()=>setShowLoginPassword(v=>!v)} aria-label={showLoginPassword?"Sembunyikan password":"Tampilkan password"} title={showLoginPassword?"Sembunyikan password":"Tampilkan password"}>{showLoginPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>{error&&<div className="notice"><AlertCircle size={16}/>{error}</div>}{recoveryMessage&&<div className="notice"><CheckCircle2 size={16}/>{recoveryMessage}</div>}<button className="primary full" disabled={busy}>{busy?'Memproses…':'Masuk ke aplikasi'}</button><button type="button" className="text-link" disabled={busy} onClick={requestPasswordReset}>Lupa password? Kirim tautan reset ke email</button><small>Akun hanya dapat dibuat oleh Super Admin.</small></form></div>;
  return <div className="shell">
    <aside className={'sidebar '+(mobile?'open':'')}><div className="side-brand"><div className="brand-mark small"><ShieldCheck/></div><div><b>SIM Inventaris</b><small>RUMAH SAKIT</small></div><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X/></button></div><div className="nav-caption">MENU UTAMA</div><nav>{nav.filter(([n])=>n!=='Manajemen Akun'||profile?.role==='super_admin').map(([n,I])=><button key={n} className={'nav-link '+(page===n?'active':'')} onClick={()=>{setPage(n);setMobile(false)}}><I size={18}/><span>{n}</span>{n==='Monitoring Shift'&&<i/>}</button>)}</nav><div className="side-bottom"><div className="user-chip"><div className="avatar">{(profile?.full_name||'P').slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name||session.user.email}</b><small>{(profile?.role||'officer').replace('_',' ')}</small></div></div><button className="nav-link" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Keluar</button></div></aside>
    {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
    <main className="main"><header className="topbar"><button className="icon-btn menu-toggle" onClick={()=>setMobile(true)}><Menu/></button><div><span className="eyebrow">SISTEM MONITORING INVENTARIS</span><h2>{page}</h2></div><div className="top-actions"><span className="live"><i/> Sistem aktif</span><button className="icon-btn" onClick={loadAll}><RefreshCw size={18}/></button><div className="avatar">{(profile?.full_name||'P').slice(0,1).toUpperCase()}</div></div></header>
    <section className="content">{error&&<div className="notice"><AlertCircle size={16}/>{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}
      {loading?<div className="loading">Memuat data inventaris…</div>:<>
      {page==='Dashboard'&&<><div className="welcome"><div><span className="eyebrow">RINGKASAN OPERASIONAL</span><h1>Selamat datang, {profile?.full_name||'Petugas'} 👋</h1><p>Pantau kondisi inventaris rumah sakit dalam satu tempat.</p></div><button className="primary" onClick={()=>setPage('Monitoring Shift')}><Camera size={17}/> Mulai Monitoring</button></div><div className="stats-grid">
      <Stat icon={Package} label="Total Inventaris" value={fmt(items.length)} tone="teal"/><Stat icon={CheckCircle2} label="Ada" value={fmt(stats.present)} tone="green"/><Stat icon={AlertCircle} label="Tidak Ada" value={fmt(stats.missing)} tone="red"/><Stat icon={Archive} label="Dipinjam" value={fmt(stats.borrowed)} tone="amber"/></div>
      <div className="two-col"><div className="panel"><div className="panel-head"><div><h3>Status Inventaris Terpantau</h3><p>Data terbaru dari monitoring terakhir per barang</p></div><span className="pill">Live data</span></div><div className="status-list"><Status label="Ada" value={stats.present} total={items.length} color="green"/><Status label="Tidak ada" value={stats.missing} total={items.length} color="red"/><Status label="Dipinjam" value={stats.borrowed} total={items.length} color="amber"/><Status label="Belum dimonitor" value={stats.unchecked} total={items.length} color="gray"/></div></div><div className="panel"><div className="panel-head"><div><h3>Monitoring Terbaru</h3><p>Aktivitas pencatatan terakhir</p></div><button className="link-btn" onClick={()=>setPage('Riwayat Monitoring')}>Lihat semua</button></div>{records.slice(0,4).map(r=><div className="activity" key={r.id}><div className="activity-icon"><ClipboardCheck size={17}/></div><div><b>{r.item_name_snapshot}</b><small>{new Date(r.recorded_at).toLocaleString('id-ID')} · {r.profiles?.full_name||r.recorded_by_name_snapshot||'Petugas'}</small></div><StatusPill value={r.status}/></div>)}{!records.length&&<Empty text="Belum ada aktivitas monitoring."/>}</div></div></>}
      {page==='Data Inventaris'&&<><div className="page-intro"><div><h1>Data Inventaris</h1><p>Kelola daftar aset dan lokasi barang rumah sakit.</p></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={17}/> Tambah Barang</button></div><div className="panel"><div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Cari nama, kode aset, atau lantai…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted">{filtered.length} barang</span></div><div className="inventory-filters"><label>Nama barang<select value={inventoryFilters.name} onChange={e=>setInventoryFilters(v=>({...v,name:e.target.value}))}><option value="">Semua nama</option>{[...new Set(items.map(x=>x.name).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Kategori<select value={inventoryFilters.category} onChange={e=>setInventoryFilters(v=>({...v,category:e.target.value}))}><option value="">Semua kategori</option>{[...new Set(items.map(x=>x.category).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Lokasi<select value={inventoryFilters.location} onChange={e=>setInventoryFilters(v=>({...v,location:e.target.value}))}><option value="">Semua lokasi</option>{[...new Set(items.map(x=>x.floors?.name).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Status<select value={inventoryFilters.status} onChange={e=>setInventoryFilters(v=>({...v,status:e.target.value}))}><option value="">Semua status</option><option value="present">Ada</option><option value="missing">Tidak ada</option><option value="borrowed">Dipinjam</option><option value="unchecked">Belum dimonitor</option></select></label><button type="button" className="filter-reset" onClick={()=>{setInventoryFilters({name:"",category:"",location:"",status:""});setSearch("");}}>Reset filter</button></div><div className="table-wrap"><table><thead><tr><th>KODE ASET</th><th>NAMA BARANG</th><th>KATEGORI</th><th>LOKASI</th><th>STATUS TERAKHIR</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td className="mono">{x.asset_code}</td><td><b>{x.name}</b></td><td>{x.category}</td><td>{x.floors?.name||'—'}</td><td><StatusPill value={returns.some(ret=>ret.monitoring_record_id===latestByItem[x.id]?.id)?'present':(latestByItem[x.id]?.status||'unchecked')}/></td></tr>)}</tbody></table>{!filtered.length&&<Empty text="Belum ada barang. Tambahkan inventaris pertama Anda."/>}</div></div></>}
      {page==='Monitoring Shift'&&<><div className="page-intro"><div><h1>Monitoring Shift</h1><p>Pilih lantai dan shift. Sistem menampilkan inventaris yang belum diperiksa hari ini.</p></div></div>
      <div className="panel form-panel checklist-filter"><div className="filter-grid"><div><label>Lantai</label><select value={monitor.floor_id} onChange={e=>setMonitor(v=>({...v,floor_id:e.target.value}))}><option value="">Pilih lantai</option>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div><div><label>Shift</label><select value={monitor.shift} onChange={e=>setMonitor(v=>({...v,shift:e.target.value}))}>{['Pagi','Siang','Malam'].map(x=><option key={x}>{x}</option>)}</select></div></div></div>
      {monitor.floor_id&&<><div className="checklist-summary"><div><b>{pendingItems.length}</b><span>Belum dimonitor</span></div><div><b>{completedIds.size}</b><span>Selesai</span></div><div><b>{checklistItems.length}</b><span>Total barang</span></div></div>
      {pendingItems.length===0?<div className="panel checklist-empty"><CheckCircle2 size={34}/><h3>Monitoring shift selesai</h3><p>Semua inventaris di lantai ini sudah diperiksa untuk shift {monitor.shift} hari ini.</p></div>:
      <div className="checklist-list">{pendingItems.map(item=><div className="panel checklist-card" key={item.id}><div className="checklist-item-head"><div><small>{item.asset_code}</small><h3>{item.name}</h3><span>{item.category||'Umum'}</span></div><span className="pending-pill">Belum diperiksa</span></div>
      <label>Kondisi barang</label><div className="choice-row">{[['present','Ada'],['missing','Tidak ada'],['borrowed','Dipinjam']].map(([v,l])=><button type="button" className={'choice '+((checkStatuses[item.id]||'present')===v?'chosen':'')} onClick={()=>setCheckStatuses(s=>({...s,[item.id]:v}))}>{l}</button>)}</div>
      <label>Foto bukti <em>* wajib</em></label><label className="upload-box checklist-upload">{checkPhotos[item.id]?<span className="photo-file-name">{checkPhotos[item.id].name}</span>:<Camera size={22}/>}<b>{checkPhotos[item.id]?'Foto siap diunggah':'Ambil / pilih foto barang'}</b><small>JPG, PNG atau WEBP · Maksimal 10 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{const file=e.target.files?.[0]||null;if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)){setError(file.size>10*1024*1024?'Ukuran foto maksimal 10 MB.':'Format foto harus JPG, PNG, atau WEBP.');e.target.value='';return;}setError('');setCheckPhotos(s=>({...s,[item.id]:file}));}}/></label>
      <label>Catatan {checkStatuses[item.id]==='borrowed'&&<em>* nama peminjam</em>}</label><textarea value={checkNotes[item.id]||''} onChange={e=>setCheckNotes(s=>({...s,[item.id]:e.target.value}))} placeholder={checkStatuses[item.id]==='borrowed'?'Nama peminjam dan keterangan…':'Tambahkan catatan bila diperlukan'}/>
      <button className="primary full" type="button" disabled={savingItem===item.id||!!savingItem} onClick={()=>saveMonitoringItem(item)}>{savingItem===item.id?'Menyimpan foto & hasil…':'Simpan hasil pemeriksaan'}</button></div>)}</div>}
      <div className="panel guide-panel"><h3>Checklist monitoring</h3><p>Daftar hanya menampilkan barang yang belum diperiksa untuk tanggal dan shift yang dipilih. Setiap barang disimpan satu per satu beserta foto, kondisi, catatan, petugas, dan waktu.</p></div></>}
      {!monitor.floor_id&&<div className="panel checklist-empty"><ClipboardCheck size={32}/><h3>Mulai monitoring</h3><p>Pilih lantai dan shift untuk menampilkan daftar inventaris yang perlu diperiksa.</p></div>}</>}
      {page==='Riwayat Monitoring'&&<><div className="page-intro"><div><h1>Riwayat Monitoring</h1><p>Rekam jejak pemeriksaan inventaris.</p></div></div>
      <div className="panel history-filter-panel"><div className="history-filter-head"><div><h3>Filter Riwayat</h3><p className="muted">Saring data berdasarkan waktu, barang, lantai, shift, dan petugas.</p></div><button className="text-button" type="button" onClick={()=>setHistoryFilters({from:'',to:'',item:'',floor:'',shift:'',staff:''})}>Reset filter</button></div>
      <div className="history-filter-grid"><div><label>Dari tanggal</label><input type="date" value={historyFilters.from} onChange={e=>setHistoryFilters(v=>({...v,from:e.target.value}))}/></div><div><label>Sampai tanggal</label><input type="date" value={historyFilters.to} onChange={e=>setHistoryFilters(v=>({...v,to:e.target.value}))}/></div>
      <div><label>Barang</label><select value={historyFilters.item} onChange={e=>setHistoryFilters(v=>({...v,item:e.target.value}))}><option value="">Semua barang</option>{historyOptions.items.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
      <div><label>Lantai</label><select value={historyFilters.floor} onChange={e=>setHistoryFilters(v=>({...v,floor:e.target.value}))}><option value="">Semua lantai</option>{historyOptions.floors.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
      <div><label>Shift</label><select value={historyFilters.shift} onChange={e=>setHistoryFilters(v=>({...v,shift:e.target.value}))}><option value="">Semua shift</option>{historyOptions.shifts.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
      <div><label>Petugas</label><select value={historyFilters.staff} onChange={e=>setHistoryFilters(v=>({...v,staff:e.target.value}))}><option value="">Semua petugas</option>{historyOptions.staff.map(x=><option key={x} value={x}>{x}</option>)}</select></div></div>
      <div className="history-filter-foot"><span>{filteredHistory.length} dari {records.length} catatan</span></div></div>
      <div className="panel table-wrap"><table><thead><tr><th>WAKTU</th><th>BARANG</th><th>LANTAI</th><th>SHIFT</th><th>PETUGAS</th><th>HASIL</th><th>FOTO</th></tr></thead><tbody>{filteredHistory.map(r=><tr key={r.id}><td>{new Date(r.recorded_at).toLocaleString('id-ID')}</td><td><b>{r.item_name_snapshot}</b><small className="block muted">{r.asset_code_snapshot}</small></td><td>{r.monitoring_sessions?.floors?.name||'—'}</td><td>{r.monitoring_sessions?.shift||'—'}</td><td>{r.profiles?.full_name||r.recorded_by_name_snapshot||r.recorded_by_email_snapshot||'Pengguna dihapus'}</td><td><StatusPill value={r.status}/></td><td>{r.photo_path?<button className="text-button photo-view-button" type="button" disabled={photoLoading===r.id} onClick={()=>viewMonitoringPhoto(r)}>{photoLoading===r.id?'Memuat…':'Lihat foto'}</button>:<span className="muted">Tidak ada foto</span>}</td></tr>)}</tbody></table>{!filteredHistory.length&&<Empty text={records.length?'Tidak ada riwayat yang cocok dengan filter.':'Belum ada riwayat monitoring.'}/>}</div></>}
      {page==='Lantai & Ruangan'&&<><div className="page-intro"><div><h1>Lantai & Ruangan</h1><p>Kelola lantai dan daftar ruangan pada setiap lantai.</p></div></div>
      {canManageLocations&&<form className="panel location-add" onSubmit={addFloor}><div><h3>Tambah Lantai</h3><p className="muted">Buat lantai baru untuk pengelompokan inventaris.</p></div><div className="inline-add"><input value={newFloorName} onChange={e=>setNewFloorName(e.target.value)} placeholder="Contoh: Lantai 4" required/><button className="primary" disabled={addingFloor}><Plus size={16}/> Tambah Lantai</button></div></form>}
      <div className="location-grid">{floors.map(f=><div className="panel floor-card" key={f.id}><div className="floor-heading"><div className="floor-icon"><Building2 size={21}/></div><div className="floor-title"><h3>{f.name}</h3><small>{items.filter(i=>i.floor_id===f.id).length} barang · {rooms.filter(r=>r.floor_id===f.id).length} ruangan</small></div>{canManageLocations&&<><button className="icon-btn edit-icon" title="Edit nama lantai" onClick={()=>editFloor(f)}><Pencil size={16}/></button><button className="icon-btn danger-icon" title="Hapus lantai" onClick={()=>deleteFloor(f)}><X size={17}/></button></>}</div><div className="room-list">{rooms.filter(r=>r.floor_id===f.id).map(room=><div className="room-row" key={room.id}><span>{room.name}</span>{canManageLocations&&<div className="room-actions"><button className="icon-btn edit-icon" title="Edit nama ruangan" onClick={()=>editRoom(room)}><Pencil size={14}/></button><button className="icon-btn danger-icon" title="Hapus ruangan" onClick={()=>deleteRoom(room)}><X size={15}/></button></div>}</div>)}{!rooms.some(r=>r.floor_id===f.id)&&<p className="empty-room">Belum ada ruangan di lantai ini.</p>}</div>{canManageLocations&&<div className="inline-add room-add"><input value={roomNames[f.id]||''} onChange={e=>setRoomNames(v=>({...v,[f.id]:e.target.value}))} placeholder="Nama ruangan, mis. IGD"/><button className="secondary" disabled={addingRoom[f.id]||!(roomNames[f.id]||'').trim()} onClick={()=>addRoom(f.id)}><Plus size={15}/> Ruangan</button></div>}</div>)}</div>
      {!canManageLocations&&<p className="hint">Anda dapat melihat daftar lokasi. Hanya Super Admin dan Admin Inventaris yang dapat menambah atau menghapus lantai dan ruangan.</p>}
      </>}
      {page==='Barang Dipinjam'&&<><div className="page-intro"><div><h1>Barang Dipinjam</h1><p>Catat barang yang telah dikembalikan agar status inventaris diperbarui.</p></div></div><div className="panel"><h3>Masih Dipinjam</h3>{Object.values(latestByItem).filter(r=>r.status==='borrowed'&&!returns.some(x=>x.monitoring_record_id===r.id)).map(r=><div className="borrowed-row" key={r.id}><div className="activity"><Archive/><div><b>{r.item_name_snapshot}</b><small>{r.borrowed_to||r.notes||'Peminjam belum dicantumkan'} · {new Date(r.recorded_at).toLocaleString('id-ID')}</small></div><StatusPill value="borrowed"/></div><div className="return-controls"><input value={returnNotes[r.id]||''} onChange={e=>setReturnNotes(v=>({...v,[r.id]:e.target.value}))} placeholder="Catatan pengembalian (opsional)"/><button className="primary" type="button" disabled={returningRecord===r.id} onClick={()=>markItemReturned(r)}>{returningRecord===r.id?'Menyimpan…':'Tandai sudah dikembalikan'}</button></div></div>)}{!Object.values(latestByItem).some(r=>r.status==='borrowed'&&!returns.some(x=>x.monitoring_record_id===r.id))&&<Empty text="Tidak ada barang yang masih dipinjam."/>}</div><div className="panel"><h3>Riwayat Pengembalian</h3>{returns.map(x=>{const record=records.find(r=>r.id===x.monitoring_record_id);return <div className="activity" key={x.id}><CheckCircle2/><div><b>{record?.item_name_snapshot||'Barang inventaris'}</b><small>{new Date(x.returned_at).toLocaleString('id-ID')}{x.notes?' · '+x.notes:''}</small></div><span className="status-pill good">Dikembalikan</span></div>;})}{!returns.length&&<Empty text="Belum ada pengembalian yang dicatat."/>}</div></>}
      {page==='Laporan'&&<div className="panel"><h3>Ringkasan Laporan</h3><p className="muted">Ringkasan status berdasarkan monitoring terbaru per barang.</p><div className="stats-grid compact"><Stat label="Ada" value={stats.present} tone="green"/><Stat label="Tidak ada" value={stats.missing} tone="red"/><Stat label="Dipinjam" value={stats.borrowed} tone="amber"/><Stat label="Belum dimonitor" value={stats.unchecked} tone="gray"/></div></div>}
      {page==='Petugas'&&<div className="panel"><h3>Profil Akun Saya</h3><div className="activity"><Users/><b>{profile?.full_name}</b><span className="muted">{profile?.role}</span></div><p className="hint">Pembuatan akun baru hanya dapat dilakukan oleh Super Admin.</p></div>}
      {page==='Manajemen Akun'&&profile?.role==='super_admin'&&<><div className="page-intro"><div><h1>Manajemen Akun Pengguna</h1><p>Buat akun petugas dan atur hak akses tanpa pendaftaran mandiri.</p></div></div><form className="panel form-panel account-create-form" onSubmit={createManagedUser}><div className="panel-head"><div><h3>Buat Akun Baru</h3><p className="muted">Akun dibuat langsung aktif dan dapat digunakan untuk login.</p></div><ShieldCheck/></div><label>Nama lengkap</label><input required minLength="2" value={newUser.full_name} onChange={e=>setNewUser(v=>({...v,full_name:e.target.value}))} placeholder="Nama petugas"/><label>Email</label><input required type="email" value={newUser.email} onChange={e=>setNewUser(v=>({...v,email:e.target.value}))} placeholder="petugas@rumahsakit.id"/><label>Password awal</label><div className="password-field"><input required type={showNewUserPassword?"text":"password"} minLength="8" value={newUser.password} onChange={e=>setNewUser(v=>({...v,password:e.target.value}))} placeholder="Minimal 8 karakter"/><button type="button" className="password-toggle" onClick={()=>setShowNewUserPassword(v=>!v)} aria-label={showNewUserPassword?"Sembunyikan password":"Tampilkan password"} title={showNewUserPassword?"Sembunyikan password":"Tampilkan password"}>{showNewUserPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><label>Hak akses</label><select value={newUser.role} onChange={e=>setNewUser(v=>({...v,role:e.target.value}))}><option value="officer">Petugas Monitoring</option><option value="inventory_admin">Admin Inventaris</option><option value="room_manager">Kepala Ruangan</option></select><button className="primary full" disabled={creatingUser}>{creatingUser?'Membuat akun…':'Buat akun pengguna'}</button>{userMessage&&<div className="success-note">{userMessage}</div>}</form><div className="panel"><div className="panel-head"><div><h3>Daftar Akun</h3><p className="muted">{users.length} akun terdaftar</p></div><button type="button" className="secondary" onClick={loadAll}><RefreshCw size={15}/> Muat ulang</button></div><div className="table-wrap"><table><thead><tr><th>NAMA PENGGUNA</th><th>HAK AKSES</th><th>DIBUAT</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.full_name||'—'}</b>{u.id===session.user.id&&<small className="block muted">Akun Anda</small>}</td><td>{({super_admin:'Super Admin',inventory_admin:'Admin Inventaris',room_manager:'Kepala Ruangan',officer:'Petugas Monitoring'})[u.role]||u.role}</td><td>{new Date(u.created_at).toLocaleDateString('id-ID')}</td></tr>)}</tbody></table></div></div></>}
      </>}
    </section></main>
    {photoPreview&&<div className="modal-backdrop photo-modal-backdrop" onClick={()=>setPhotoPreview(null)}><div className="modal photo-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h3>{photoPreview.title}</h3><small className="muted">{photoPreview.date}</small></div><button type="button" className="icon-btn" onClick={()=>setPhotoPreview(null)}><X/></button></div><img src={photoPreview.url} alt={'Foto bukti monitoring '+photoPreview.title}/><button type="button" className="secondary full" onClick={()=>setPhotoPreview(null)}>Tutup</button></div></div>}
    {showAdd&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><form className="modal" onClick={e=>e.stopPropagation()} onSubmit={addItem}><div className="modal-head"><h3>Tambah Inventaris</h3><button type="button" className="icon-btn" onClick={()=>setShowAdd(false)}><X/></button></div><label>Kode aset</label><input required value={newItem.asset_code} onChange={e=>setNewItem({...newItem,asset_code:e.target.value})}/><label>Nama barang</label><input required value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})}/><label>Kategori</label><input value={newItem.category} onChange={e=>setNewItem({...newItem,category:e.target.value})}/><label>Lantai</label><select required value={newItem.floor_id} onChange={e=>setNewItem({...newItem,floor_id:e.target.value})}><option value="">Pilih lantai</option>{floors.map(f=><option value={f.id}>{f.name}</option>)}</select><label>Catatan</label><textarea value={newItem.notes} onChange={e=>setNewItem({...newItem,notes:e.target.value})}/><button className="primary full" disabled={busy}>Simpan barang</button></form></div>}
  </div>;
}
function Stat({icon:Icon,label,value,tone}){return <div className="stat-card"><div className={'stat-icon '+tone}>{Icon&&<Icon size={19}/>}</div><div><small>{label}</small><strong>{value}</strong></div></div>}
function Status({label,value,total,color}){const pct=total?Math.round(value/total*100):0;return <div className="status-row"><div><span>{label}</span><b>{value}</b></div><div className="bar"><i className={color} style={{width:pct+'%'}}/></div></div>}
function StatusPill({value}){const map={present:['Ada','good'],missing:['Tidak ada','bad'],borrowed:['Dipinjam','warn'],unchecked:['Belum dimonitor','neutral']};const [label,cls]=map[value]||map.unchecked;return <span className={'status-pill '+cls}>{label}</span>}
function Empty({text}){return <div className="empty"><ClipboardCheck size={25}/><p>{text}</p></div>}
export default App;