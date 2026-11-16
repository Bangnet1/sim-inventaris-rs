import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { Activity, Archive, BarChart3, Building2, Camera, ClipboardCheck, Clock3, LayoutDashboard, LogOut, Menu, Package, Search, Settings, ShieldCheck, Users, X, Plus, ChevronDown, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

const nav = [
  ['Dashboard',LayoutDashboard],['Monitoring Shift',ClipboardCheck],['Data Inventaris',Package],['Lantai & Ruangan',Building2],['Barang Dipinjam',Archive],['Riwayat Monitoring',Clock3],['Laporan',BarChart3],['Petugas',Users]
];
const fmt = n => new Intl.NumberFormat('id-ID').format(n || 0);
function App(){
  const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[page,setPage]=useState(()=>{try{return localStorage.getItem('sim-inventaris-rs:last-page')||'Dashboard';}catch{return 'Dashboard';}}),[mobile,setMobile]=useState(false);
  const [items,setItems]=useState([]),[floors,setFloors]=useState([]),[rooms,setRooms]=useState([]),[records,setRecords]=useState([]),[sessions,setSessions]=useState([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  const [search,setSearch]=useState(''),[showAdd,setShowAdd]=useState(false),[newItem,setNewItem]=useState({asset_code:'',name:'',category:'Umum',floor_id:'',notes:''});\n  const [newFloorName,setNewFloorName]=useState(''),[roomNames,setRoomNames]=useState({}),[addingFloor,setAddingFloor]=useState(false),[addingRoom,setAddingRoom]=useState({});
  const [monitor,setMonitor]=useState({floor_id:'',shift:'Pagi'}),[photo,setPhoto]=useState(null),[monitorStatus,setMonitorStatus]=useState('present'),[monitorItem,setMonitorItem]=useState(''),[notes,setNotes]=useState('');
  useEffect(()=>{ if(!supabase){setLoading(false);return;} supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>subscription.unsubscribe(); },[]);\n  useEffect(()=>{try{localStorage.setItem('sim-inventaris-rs:last-page',page);}catch{}},[page]);
  useEffect(()=>{ if(session?.user) loadAll(); else {setProfile(null);setLoading(false);} },[session]);
  async function loadAll(){
    setLoading(true);setError('');
    try{
      const [p,i,f,rm,r,s]=await Promise.all([
        supabase.from('profiles').select('*').eq('id',session.user.id).single(),
        supabase.from('inventory_items').select('*, floors(name)').eq('is_active',true).order('name'),
        supabase.from('floors').select('*').eq('is_active',true).order('sort_order'),
        supabase.from('monitoring_records').select('*, inventory_items(name,asset_code), monitoring_sessions(monitoring_date,shift,floors(name)), profiles!monitoring_records_recorded_by_profile_fkey(full_name)').order('recorded_at',{ascending:false}).limit(100),
        supabase.from('monitoring_sessions').select('*, floors(name)').order('started_at',{ascending:false}).limit(30)
      ]);
      if(p.error) throw p.error; if(i.error) throw i.error; if(f.error) throw f.error;
      setProfile(p.data);setItems(i.data||[]);setFloors(f.data||[]);setRooms(rm.data||[]);setRecords(r.data||[]);setSessions(s.data||[]);
    }catch(e){setError(e.message||'Gagal memuat data');}finally{setLoading(false);}
  }
  async function signIn(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setBusy(false);}
  async function signUp(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:email.split('@')[0]}}});setError(error?error.message:'Akun berhasil dibuat. Jika konfirmasi email aktif, cek email Anda.');setBusy(false);}
  async function addItem(e){e.preventDefault();setBusy(true);const {error}=await supabase.from('inventory_items').insert({...newItem,created_by:session.user.id});if(error)setError(error.message);else{setShowAdd(false);setNewItem({asset_code:'',name:'',category:'Umum',floor_id:'',notes:''});await loadAll();}setBusy(false);}
  const canManageLocations=['super_admin','inventory_admin'].includes(profile?.role);
  async function addFloor(e){
    e.preventDefault(); if(!newFloorName.trim())return;
    setAddingFloor(true);setError('');
    const {error}=await supabase.from('floors').insert({name:newFloorName.trim(),sort_order:floors.length+1});
    if(error)setError(error.message);else{setNewFloorName('');await loadAll();}
    setAddingFloor(false);
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
  async function deleteRoom(room){
    const {data:used,error:checkError}=await supabase.from('inventory_items').select('id').eq('room_id',room.id).limit(1);
    if(checkError){setError(checkError.message);return;}
    if(used?.length){setError('Ruangan masih digunakan oleh inventaris. Pindahkan inventaris ke ruangan lain terlebih dahulu.');return;}
    if(!window.confirm('Hapus ruangan '+room.name+'?'))return;
    const {error}=await supabase.from('rooms').delete().eq('id',room.id);
    if(error)setError(error.message);else await loadAll();
  }

  async function saveMonitoring(e){
    e.preventDefault(); if(!photo||!monitorItem){setError('Pilih barang dan foto bukti terlebih dahulu.');return;}
    setBusy(true);setError('');
    try{
      let sess=sessions.find(x=>x.floor_id===monitor.floor_id&&x.monitoring_date===new Date().toLocaleDateString('en-CA')&&x.shift===monitor.shift&&x.status==='draft');
      if(!sess){const {data,error}=await supabase.from('monitoring_sessions').insert({floor_id:monitor.floor_id,shift:monitor.shift,started_by:session.user.id}).select().single();if(error)throw error;sess=data;}
      const path=session.user.id+'/'+sess.id+'/'+monitorItem+'-'+Date.now()+'.'+photo.name.split('.').pop();
      const up=await supabase.storage.from('monitoring-photos').upload(path,photo,{contentType:photo.type,upsert:false});if(up.error)throw up.error;
      const item=items.find(x=>x.id===monitorItem);
      const {error}=await supabase.from('monitoring_records').insert({session_id:sess.id,inventory_item_id:item.id,item_name_snapshot:item.name,asset_code_snapshot:item.asset_code,status:monitorStatus,photo_path:path,notes,borrowed_to:monitorStatus==='borrowed'?notes:null,recorded_by:session.user.id});
      if(error)throw error;
      setPhoto(null);setNotes('');setMonitorItem('');await loadAll();setError('Monitoring berhasil disimpan.');
    }catch(e){setError(e.message||'Gagal menyimpan monitoring');}finally{setBusy(false);}
  }
  const latestByItem=useMemo(()=>{const m={};records.forEach(r=>{if(!m[r.inventory_item_id])m[r.inventory_item_id]=r;});return m;},[records]);
  const stats=useMemo(()=>{const vals=Object.values(latestByItem);return {present:vals.filter(x=>x.status==='present').length,missing:vals.filter(x=>x.status==='missing').length,borrowed:vals.filter(x=>x.status==='borrowed').length,unchecked:Math.max(0,items.length-vals.length)};},[items,latestByItem]);
  const filtered=items.filter(x=>(x.name+' '+x.asset_code+' '+(x.floors?.name||'')).toLowerCase().includes(search.toLowerCase()));
  if(!supabase)return <div className="setup"><div className="login-card"><div className="brand-mark"><ShieldCheck/></div><h1>SIM Inventaris RS</h1><p>Konfigurasi Supabase belum ditemukan.</p><p>Buat file <code>.env</code> dari <code>.env.example</code>, isi URL dan publishable key, lalu jalankan ulang aplikasi.</p></div></div>;
  if(!session)return <div className="setup"><form className="login-card" onSubmit={signIn}><div className="brand-mark"><ShieldCheck/></div><span className="eyebrow">SISTEM INFORMASI RUMAH SAKIT</span><h1>SIM Inventaris RS</h1><p className="muted">Monitoring inventaris yang tertib, akurat, dan terdokumentasi.</p><label>Email petugas</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@rumahsakit.id"/><label>Password</label><input type="password" required minLength="6" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password"/>{error&&<div className="notice"><AlertCircle size={16}/>{error}</div>}<button className="primary full" disabled={busy}>{busy?'Memproses…':'Masuk ke aplikasi'}</button><button type="button" className="text-button" onClick={signUp} disabled={busy}>Belum punya akun? Daftar petugas</button><small>Akses dibatasi untuk pengguna terdaftar.</small></form></div>;
  return <div className="shell">
    <aside className={'sidebar '+(mobile?'open':'')}><div className="side-brand"><div className="brand-mark small"><ShieldCheck/></div><div><b>SIM Inventaris</b><small>RUMAH SAKIT</small></div><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X/></button></div><div className="nav-caption">MENU UTAMA</div><nav>{nav.map(([n,I])=><button key={n} className={'nav-link '+(page===n?'active':'')} onClick={()=>{setPage(n);setMobile(false)}}><I size={18}/><span>{n}</span>{n==='Monitoring Shift'&&<i/>}</button>)}</nav><div className="side-bottom"><div className="user-chip"><div className="avatar">{(profile?.full_name||'P').slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name||session.user.email}</b><small>{(profile?.role||'officer').replace('_',' ')}</small></div></div><button className="nav-link" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Keluar</button></div></aside>
    {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
    <main className="main"><header className="topbar"><button className="icon-btn menu-toggle" onClick={()=>setMobile(true)}><Menu/></button><div><span className="eyebrow">SISTEM MONITORING INVENTARIS</span><h2>{page}</h2></div><div className="top-actions"><span className="live"><i/> Sistem aktif</span><button className="icon-btn" onClick={loadAll}><RefreshCw size={18}/></button><div className="avatar">{(profile?.full_name||'P').slice(0,1).toUpperCase()}</div></div></header>
    <section className="content">{error&&<div className="notice"><AlertCircle size={16}/>{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}
      {loading?<div className="loading">Memuat data inventaris…</div>:<>
      {page==='Dashboard'&&<><div className="welcome"><div><span className="eyebrow">RINGKASAN OPERASIONAL</span><h1>Selamat datang, {profile?.full_name||'Petugas'} 👋</h1><p>Pantau kondisi inventaris rumah sakit dalam satu tempat.</p></div><button className="primary" onClick={()=>setPage('Monitoring Shift')}><Camera size={17}/> Mulai Monitoring</button></div><div className="stats-grid">
      <Stat icon={Package} label="Total Inventaris" value={fmt(items.length)} tone="teal"/><Stat icon={CheckCircle2} label="Ada" value={fmt(stats.present)} tone="green"/><Stat icon={AlertCircle} label="Tidak Ada" value={fmt(stats.missing)} tone="red"/><Stat icon={Archive} label="Dipinjam" value={fmt(stats.borrowed)} tone="amber"/></div>
      <div className="two-col"><div className="panel"><div className="panel-head"><div><h3>Status Inventaris Terpantau</h3><p>Data terbaru dari monitoring terakhir per barang</p></div><span className="pill">Live data</span></div><div className="status-list"><Status label="Ada" value={stats.present} total={items.length} color="green"/><Status label="Tidak ada" value={stats.missing} total={items.length} color="red"/><Status label="Dipinjam" value={stats.borrowed} total={items.length} color="amber"/><Status label="Belum dimonitor" value={stats.unchecked} total={items.length} color="gray"/></div></div><div className="panel"><div className="panel-head"><div><h3>Monitoring Terbaru</h3><p>Aktivitas pencatatan terakhir</p></div><button className="link-btn" onClick={()=>setPage('Riwayat Monitoring')}>Lihat semua</button></div>{records.slice(0,4).map(r=><div className="activity" key={r.id}><div className="activity-icon"><ClipboardCheck size={17}/></div><div><b>{r.item_name_snapshot}</b><small>{new Date(r.recorded_at).toLocaleString('id-ID')} · {r.profiles?.full_name||'Petugas'}</small></div><StatusPill value={r.status}/></div>)}{!records.length&&<Empty text="Belum ada aktivitas monitoring."/>}</div></div></>}
      {page==='Data Inventaris'&&<><div className="page-intro"><div><h1>Data Inventaris</h1><p>Kelola daftar aset dan lokasi barang rumah sakit.</p></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={17}/> Tambah Barang</button></div><div className="panel"><div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Cari nama, kode aset, atau lantai…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted">{filtered.length} barang</span></div><div className="table-wrap"><table><thead><tr><th>KODE ASET</th><th>NAMA BARANG</th><th>KATEGORI</th><th>LOKASI</th><th>STATUS TERAKHIR</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td className="mono">{x.asset_code}</td><td><b>{x.name}</b></td><td>{x.category}</td><td>{x.floors?.name||'—'}</td><td><StatusPill value={latestByItem[x.id]?.status||'unchecked'}/></td></tr>)}</tbody></table>{!filtered.length&&<Empty text="Belum ada barang. Tambahkan inventaris pertama Anda."/>}</div></div></>}
      {page==='Monitoring Shift'&&<><div className="page-intro"><div><h1>Monitoring Shift</h1><p>Foto kondisi setiap barang sesuai daftar inventaris di lantai.</p></div></div><div className="monitor-grid"><form className="panel form-panel" onSubmit={saveMonitoring}><h3>Catat kondisi barang</h3><p className="muted">Identitas petugas, tanggal, dan waktu akan tercatat otomatis.</p><label>Lantai</label><select required value={monitor.floor_id} onChange={e=>setMonitor({...monitor,floor_id:e.target.value})}><option value="">Pilih lantai</option>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><label>Shift</label><select value={monitor.shift} onChange={e=>setMonitor({...monitor,shift:e.target.value})}>{['Pagi','Siang','Malam'].map(x=><option>{x}</option>)}</select><label>Pilih barang</label><select required value={monitorItem} onChange={e=>setMonitorItem(e.target.value)}><option value="">Pilih dari daftar inventaris</option>{items.filter(x=>!monitor.floor_id||x.floor_id===monitor.floor_id).map(x=><option key={x.id} value={x.id}>{x.asset_code} — {x.name}</option>)}</select><label>Kondisi barang</label><div className="choice-row">{[['present','Ada'],['missing','Tidak ada'],['borrowed','Dipinjam']].map(([v,l])=><button type="button" className={'choice '+(monitorStatus===v?'chosen':'')} onClick={()=>setMonitorStatus(v)}>{l}</button>)}</div><label>Foto bukti <em>* wajib</em></label><label className="upload-box"><Camera size={24}/><b>{photo?photo.name:'Ambil / pilih foto barang'}</b><small>JPG, PNG atau WEBP · Maksimal 10 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label><label>Catatan {monitorStatus==='borrowed'&&<em>* nama peminjam</em>}</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} required={monitorStatus==='borrowed'} placeholder={monitorStatus==='borrowed'?'Nama peminjam dan keterangan…':'Tambahkan keterangan bila diperlukan'}/><button className="primary full" disabled={busy}>{busy?'Menyimpan…':'Simpan hasil monitoring'}</button></form><div className="panel guide-panel"><div className="guide-icon"><ShieldCheck/></div><h3>Checklist monitoring</h3><p>Pastikan seluruh barang pada daftar lantai telah diperiksa.</p><ul><li>Foto harus jelas dan menunjukkan barang yang diperiksa.</li><li>Setiap barang dicatat satu kali per sesi shift.</li><li>Barang yang belum diperiksa tetap berstatus <b>Belum dimonitor</b>, bukan hilang.</li><li>Riwayat monitoring disimpan sebagai catatan audit.</li></ul><div className="guide-note"><Clock3 size={18}/><span>Waktu dan akun petugas dicatat otomatis oleh sistem.</span></div></div></div></>}
      {page==='Riwayat Monitoring'&&<><div className="page-intro"><div><h1>Riwayat Monitoring</h1><p>Rekam jejak pemeriksaan inventaris.</p></div></div><div className="panel table-wrap"><table><thead><tr><th>WAKTU</th><th>BARANG</th><th>LANTAI</th><th>SHIFT</th><th>PETUGAS</th><th>HASIL</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td>{new Date(r.recorded_at).toLocaleString('id-ID')}</td><td><b>{r.item_name_snapshot}</b><small className="block muted">{r.asset_code_snapshot}</small></td><td>{r.monitoring_sessions?.floors?.name||'—'}</td><td>{r.monitoring_sessions?.shift||'—'}</td><td>{r.profiles?.full_name||'—'}</td><td><StatusPill value={r.status}/></td></tr>)}</tbody></table>{!records.length&&<Empty text="Belum ada riwayat monitoring."/>}</div></>}
      {page==='Lantai & Ruangan'&&<><div className="page-intro"><div><h1>Lantai & Ruangan</h1><p>Kelola lantai dan daftar ruangan pada setiap lantai.</p></div></div>
      {canManageLocations&&<form className="panel location-add" onSubmit={addFloor}><div><h3>Tambah Lantai</h3><p className="muted">Buat lantai baru untuk pengelompokan inventaris.</p></div><div className="inline-add"><input value={newFloorName} onChange={e=>setNewFloorName(e.target.value)} placeholder="Contoh: Lantai 4" required/><button className="primary" disabled={addingFloor}><Plus size={16}/> Tambah Lantai</button></div></form>}
      <div className="location-grid">{floors.map(f=><div className="panel floor-card" key={f.id}><div className="floor-heading"><div className="floor-icon"><Building2 size={21}/></div><div className="floor-title"><h3>{f.name}</h3><small>{items.filter(i=>i.floor_id===f.id).length} barang · {rooms.filter(r=>r.floor_id===f.id).length} ruangan</small></div>{canManageLocations&&<button className="icon-btn danger-icon" title="Hapus lantai" onClick={()=>deleteFloor(f)}><X size={17}/></button>}</div><div className="room-list">{rooms.filter(r=>r.floor_id===f.id).map(room=><div className="room-row" key={room.id}><span>{room.name}</span>{canManageLocations&&<button className="icon-btn danger-icon" title="Hapus ruangan" onClick={()=>deleteRoom(room)}><X size={15}/></button>}</div>)}{!rooms.some(r=>r.floor_id===f.id)&&<p className="empty-room">Belum ada ruangan di lantai ini.</p>}</div>{canManageLocations&&<div className="inline-add room-add"><input value={roomNames[f.id]||''} onChange={e=>setRoomNames(v=>({...v,[f.id]:e.target.value}))} placeholder="Nama ruangan, mis. IGD"/><button className="secondary" disabled={addingRoom[f.id]||!(roomNames[f.id]||'').trim()} onClick={()=>addRoom(f.id)}><Plus size={15}/> Ruangan</button></div>}</div>)}</div>
      {!canManageLocations&&<p className="hint">Anda dapat melihat daftar lokasi. Hanya Super Admin dan Admin Inventaris yang dapat menambah atau menghapus lantai dan ruangan.</p>}
      </>}
      {page==='Barang Dipinjam'&&<div className="panel"><h3>Barang Dipinjam</h3>{records.filter(r=>r.status==='borrowed').map(r=><div className="activity" key={r.id}><Archive/><div><b>{r.item_name_snapshot}</b><small>{r.notes||'Peminjam belum dicantumkan'}</small></div><StatusPill value="borrowed"/></div>)}{!records.some(r=>r.status==='borrowed')&&<Empty text="Tidak ada barang berstatus dipinjam pada data terbaru."/>}</div>}
      {page==='Laporan'&&<div className="panel"><h3>Ringkasan Laporan</h3><p className="muted">Ringkasan status berdasarkan monitoring terbaru per barang.</p><div className="stats-grid compact"><Stat label="Ada" value={stats.present} tone="green"/><Stat label="Tidak ada" value={stats.missing} tone="red"/><Stat label="Dipinjam" value={stats.borrowed} tone="amber"/><Stat label="Belum dimonitor" value={stats.unchecked} tone="gray"/></div></div>}
      {page==='Petugas'&&<div className="panel"><h3>Profil Petugas Aktif</h3><p className="muted">Daftar profil pengguna yang telah terdaftar.</p><div className="activity"><Users/><b>{profile?.full_name}</b><span className="muted">{profile?.role}</span></div><p className="hint">Penetapan administrator dilakukan melalui pengaturan aman di Supabase, bukan melalui formulir publik.</p></div>}
      </>}
    </section></main>
    {showAdd&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><form className="modal" onClick={e=>e.stopPropagation()} onSubmit={addItem}><div className="modal-head"><h3>Tambah Inventaris</h3><button type="button" className="icon-btn" onClick={()=>setShowAdd(false)}><X/></button></div><label>Kode aset</label><input required value={newItem.asset_code} onChange={e=>setNewItem({...newItem,asset_code:e.target.value})}/><label>Nama barang</label><input required value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})}/><label>Kategori</label><input value={newItem.category} onChange={e=>setNewItem({...newItem,category:e.target.value})}/><label>Lantai</label><select required value={newItem.floor_id} onChange={e=>setNewItem({...newItem,floor_id:e.target.value})}><option value="">Pilih lantai</option>{floors.map(f=><option value={f.id}>{f.name}</option>)}</select><label>Catatan</label><textarea value={newItem.notes} onChange={e=>setNewItem({...newItem,notes:e.target.value})}/><button className="primary full" disabled={busy}>Simpan barang</button></form></div>}
  </div>;
}
function Stat({icon:Icon,label,value,tone}){return <div className="stat-card"><div className={'stat-icon '+tone}>{Icon&&<Icon size={19}/>}</div><div><small>{label}</small><strong>{value}</strong></div></div>}
function Status({label,value,total,color}){const pct=total?Math.round(value/total*100):0;return <div className="status-row"><div><span>{label}</span><b>{value}</b></div><div className="bar"><i className={color} style={{width:pct+'%'}}/></div></div>}
function StatusPill({value}){const map={present:['Ada','good'],missing:['Tidak ada','bad'],borrowed:['Dipinjam','warn'],unchecked:['Belum dimonitor','neutral']};const [label,cls]=map[value]||map.unchecked;return <span className={'status-pill '+cls}>{label}</span>}
function Empty({text}){return <div className="empty"><ClipboardCheck size={25}/><p>{text}</p></div>}
export default App;