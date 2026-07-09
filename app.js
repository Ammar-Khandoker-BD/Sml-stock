const DEFAULT_LOW_STOCK = 5;
let ITEMS = [];
let SUPPLIERS = [];
let currentUserEmail = '';
let currentRole = 'staff';
let charts = {};

// ---------- Auth guard + role fetch ----------
auth.onAuthStateChanged(user=>{
  if(!user){ window.location.href = 'index.html'; return; }
  currentUserEmail = user.email;
  document.getElementById('userChip').textContent = user.email;

  db.collection('roles').doc(user.email).get().then(doc=>{
    currentRole = (doc.exists && doc.data().role === 'admin') ? 'admin' : 'staff';
    const badge = document.getElementById('roleBadge');
    badge.textContent = currentRole.toUpperCase();
    badge.className = 'role-badge ' + currentRole;
    if(currentRole === 'admin'){
      document.querySelectorAll('.admin-only').forEach(el=> el.style.display = '');
    }
    loadItems();
    loadHistory();
    loadSuppliers();
    if(currentRole === 'admin') loadAccessList();
  });
});

document.getElementById('logoutBtn').addEventListener('click', ()=> auth.signOut());

// ---------- Nav switching ----------
const VIEWS = ['inventory','alerts','reports','history','suppliers','manage-items','manage-access'];
document.querySelectorAll('.nav-item').forEach(el=>{
  el.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    el.classList.add('active');
    const view = el.dataset.view;
    VIEWS.forEach(v=>{
      const node = document.getElementById('view-'+v);
      if(node) node.style.display = (v===view) ? '' : 'none';
    });
    if(view === 'reports') renderCharts();
  });
});

// ---------- Load items ----------
function loadItems(){
  db.collection('items').orderBy('sl').get().then(snap=>{
    ITEMS = [];
    snap.forEach(doc=> ITEMS.push({id:doc.id, ...doc.data()}));
    document.getElementById('importBanner').style.display = (ITEMS.length===0 && currentRole==='admin') ? 'flex' : 'none';
    populateTypeFilter();
    populateItemSelects();
    renderTable();
    renderAlerts();
    if(currentRole === 'admin') renderManageItems();
  });
}

document.getElementById('importBtn').addEventListener('click', ()=>{
  fetch('items-seed.json').then(r=>r.json()).then(seed=>{
    const batch = db.batch();
    seed.forEach(it=>{
      const ref = db.collection('items').doc(String(it.sl));
      batch.set(ref, {...it, price: it.price||0, reorder_level: it.reorder_level ?? DEFAULT_LOW_STOCK});
    });
    batch.commit().then(()=>{
      document.getElementById('importBanner').style.display = 'none';
      loadItems();
    });
  });
});

function populateTypeFilter(){
  const sel = document.getElementById('typeFilter');
  const types = [...new Set(ITEMS.map(i=>i.type).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Types</option>' + types.map(t=>`<option value="${t}">${t}</option>`).join('');
}

function populateItemSelects(){
  const label = it => `${it.type} — ${it.color || 'N/A'} — ${it.thickness} (SL ${it.sl})`;
  const opts = ITEMS.map(it=>`<option value="${it.id}">${label(it)}</option>`).join('');
  document.getElementById('addItemSelect').innerHTML = opts;
  document.getElementById('useItemSelect').innerHTML = opts;
}

// ---------- Filters ----------
document.getElementById('searchInput').addEventListener('input', renderTable);
document.getElementById('typeFilter').addEventListener('change', renderTable);

function reorderLevelOf(it){
  return (it.reorder_level === undefined || it.reorder_level === null) ? DEFAULT_LOW_STOCK : Number(it.reorder_level);
}

function renderTable(){
  const q = document.getElementById('searchInput').value.toLowerCase();
  const typeF = document.getElementById('typeFilter').value;
  const body = document.getElementById('itemsBody');
  const filtered = ITEMS.filter(it=>{
    const hay = `${it.type} ${it.color||''} ${it.thickness}`.toLowerCase();
    return hay.includes(q) && (!typeF || it.type===typeF);
  });

  const totalValue = ITEMS.reduce((s,i)=> s + (Number(i.stock)||0) * (Number(i.price)||0), 0);
  document.getElementById('statTotal').textContent = ITEMS.length;
  document.getElementById('statStock').textContent = ITEMS.reduce((s,i)=>s+(Number(i.stock)||0),0);
  document.getElementById('statLow').textContent = ITEMS.filter(i=>(Number(i.stock)||0) <= reorderLevelOf(i)).length;
  document.getElementById('statValue').textContent = 'Tk ' + totalValue.toLocaleString('en-BD', {maximumFractionDigits:0});

  document.getElementById('itemsEmpty').style.display = filtered.length ? 'none' : 'block';

  body.innerHTML = filtered.map(it=>{
    const stock = Number(it.stock)||0;
    const price = Number(it.price)||0;
    const value = stock * price;
    const low = stock <= reorderLevelOf(it);
    const bars = Math.max(1, Math.min(10, Math.ceil(stock/5)));
    const gaugeClass = stock===0 ? 'empty' : (low ? 'low' : '');
    const barsHtml = Array.from({length:bars}).map(()=>'<div></div>').join('');
    return `<tr>
      <td class="mono">${it.sl}</td>
      <td>${it.type}</td>
      <td>${it.color||'—'}</td>
      <td>${it.thickness}</td>
      <td><span class="qty-badge">${stock}</span>${low?'<span class="low-tag">LOW</span>':''}</td>
      <td class="mono">Tk ${price.toLocaleString('en-BD')}</td>
      <td class="mono">Tk ${value.toLocaleString('en-BD', {maximumFractionDigits:0})}</td>
      <td><div class="stack-gauge ${gaugeClass}">${barsHtml}</div></td>
    </tr>`;
  }).join('');
}

// ---------- Alerts ----------
function renderAlerts(){
  const low = ITEMS.filter(it=> (Number(it.stock)||0) <= reorderLevelOf(it));
  const body = document.getElementById('alertsBody');
  document.getElementById('alertsEmpty').style.display = low.length ? 'none' : 'block';
  body.innerHTML = low.map(it=>`<tr>
    <td class="mono">${it.sl}</td><td>${it.type}</td><td>${it.color||'—'}</td><td>${it.thickness}</td>
    <td class="mono" style="color:var(--red);">${it.stock}</td><td class="mono">${reorderLevelOf(it)}</td>
  </tr>`).join('');
  const countEl = document.getElementById('alertCount');
  if(low.length > 0){
    countEl.textContent = low.length;
    countEl.style.display = 'inline-block';
  } else {
    countEl.style.display = 'none';
  }
}

// ---------- Stock In / Out modals ----------
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

document.getElementById('openAddModal').addEventListener('click', ()=>{
  document.getElementById('addDate').value = new Date().toISOString().slice(0,10);
  openModal('addModal');
});
document.getElementById('openUseModal').addEventListener('click', ()=>{
  document.getElementById('useDate').value = new Date().toISOString().slice(0,10);
  openModal('useModal');
});
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=> closeModal(btn.dataset.close));
});

document.getElementById('confirmAdd').addEventListener('click', ()=>{
  const itemId = document.getElementById('addItemSelect').value;
  const qty = parseFloat(document.getElementById('addQty').value);
  const date = document.getElementById('addDate').value;
  const supplierId = document.getElementById('addSupplierSelect').value;
  const supplierName = supplierId ? (SUPPLIERS.find(s=>s.id===supplierId)?.name || '') : '';
  if(!itemId || !qty || qty<=0) return;
  applyTransaction(itemId, qty, date, supplierName);
  closeModal('addModal');
  document.getElementById('addQty').value = '';
});

document.getElementById('confirmUse').addEventListener('click', ()=>{
  const itemId = document.getElementById('useItemSelect').value;
  const qty = parseFloat(document.getElementById('useQty').value);
  const date = document.getElementById('useDate').value;
  if(!itemId || !qty || qty<=0) return;
  applyTransaction(itemId, -qty, date, '');
  closeModal('useModal');
  document.getElementById('useQty').value = '';
});

function applyTransaction(itemId, delta, date, supplier){
  const itemRef = db.collection('items').doc(itemId);
  db.runTransaction(t=>{
    return t.get(itemRef).then(doc=>{
      const current = Number(doc.data().stock)||0;
      t.update(itemRef, {stock: current + delta});
    });
  }).then(()=>{
    const item = ITEMS.find(i=>i.id===itemId);
    db.collection('transactions').add({
      itemId, sl: item.sl, type: item.type, color: item.color||'', thickness: item.thickness,
      change: delta, date, supplier: supplier||'', by: currentUserEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(()=>{ loadItems(); loadHistory(); });
  });
}

// ---------- History ----------
let HISTORY_CACHE = [];
function loadHistory(){
  db.collection('transactions').orderBy('createdAt','desc').limit(200).get().then(snap=>{
    HISTORY_CACHE = [];
    const body = document.getElementById('historyBody');
    const rows = [];
    snap.forEach(doc=>{
      const d = doc.data();
      HISTORY_CACHE.push(d);
      const positive = d.change > 0;
      rows.push(`<tr>
        <td class="mono">${d.date||'—'}</td>
        <td>SL ${d.sl}</td>
        <td>${d.type} ${d.color?('— '+d.color):''} — ${d.thickness}</td>
        <td class="mono" style="color:${positive?'var(--green)':'var(--red)'}">${positive?'+':''}${d.change}</td>
        <td>${d.supplier||'—'}</td>
        <td>${d.by||'—'}</td>
      </tr>`);
    });
    body.innerHTML = rows.join('');
    document.getElementById('historyEmpty').style.display = rows.length ? 'none' : 'block';
  });
}

// ---------- Manage Items (admin) ----------
function renderManageItems(){
  const body = document.getElementById('manageItemsBody');
  body.innerHTML = ITEMS.map(it=>`<tr>
    <td class="mono">${it.sl}</td>
    <td>${it.type}</td>
    <td>${it.color||'—'}</td>
    <td>${it.thickness}</td>
    <td class="mono">${it.stock}</td>
    <td class="mono">Tk ${Number(it.price||0).toLocaleString('en-BD')}</td>
    <td class="mono">${reorderLevelOf(it)}</td>
    <td>
      <button class="icon-btn" data-edit="${it.id}">Edit</button>
      <button class="icon-btn danger" data-del="${it.id}">Delete</button>
    </td>
  </tr>`).join('');

  body.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=> openItemModal(ITEMS.find(i=>i.id===btn.dataset.edit)));
  });
  body.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirm('Delete this item? This cannot be undone.')){
        db.collection('items').doc(btn.dataset.del).delete().then(loadItems);
      }
    });
  });
}

document.getElementById('openNewItemModal').addEventListener('click', ()=> openItemModal(null));

function openItemModal(item){
  document.getElementById('itemModalTitle').textContent = item ? 'Edit Item' : 'New Item';
  document.getElementById('itemModalId').value = item ? item.id : '';
  document.getElementById('itemType').value = item ? item.type : '';
  document.getElementById('itemColor').value = item ? (item.color||'') : '';
  document.getElementById('itemThickness').value = item ? item.thickness : '';
  document.getElementById('itemStock').value = item ? item.stock : 0;
  document.getElementById('itemPrice').value = item ? (item.price||0) : 0;
  document.getElementById('itemReorder').value = item ? reorderLevelOf(item) : DEFAULT_LOW_STOCK;
  openModal('itemModal');
}

document.getElementById('confirmItem').addEventListener('click', ()=>{
  const id = document.getElementById('itemModalId').value;
  const type = document.getElementById('itemType').value.trim();
  const color = document.getElementById('itemColor').value.trim();
  const thickness = document.getElementById('itemThickness').value.trim();
  const stock = parseFloat(document.getElementById('itemStock').value) || 0;
  const price = parseFloat(document.getElementById('itemPrice').value) || 0;
  const reorder_level = parseFloat(document.getElementById('itemReorder').value);
  if(!type || !thickness) return;

  if(id){
    db.collection('items').doc(id).update({type, color, thickness, stock, price, reorder_level}).then(()=>{
      closeModal('itemModal'); loadItems();
    });
  } else {
    const nextSl = ITEMS.length ? Math.max(...ITEMS.map(i=>i.sl)) + 1 : 1;
    db.collection('items').doc(String(nextSl)).set({sl: nextSl, page: null, type, color, thickness, stock, price, reorder_level}).then(()=>{
      closeModal('itemModal'); loadItems();
    });
  }
});

// ---------- Suppliers (admin manages, everyone can view in dropdown) ----------
function loadSuppliers(){
  db.collection('suppliers').orderBy('name').get().then(snap=>{
    SUPPLIERS = [];
    snap.forEach(doc=> SUPPLIERS.push({id:doc.id, ...doc.data()}));
    const sel = document.getElementById('addSupplierSelect');
    sel.innerHTML = '<option value="">— None —</option>' + SUPPLIERS.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    if(currentRole === 'admin') renderSuppliers();
  });
}

function renderSuppliers(){
  const body = document.getElementById('suppliersBody');
  document.getElementById('suppliersEmpty').style.display = SUPPLIERS.length ? 'none' : 'block';
  body.innerHTML = SUPPLIERS.map(s=>`<tr>
    <td>${s.name}</td><td>${s.contact||'—'}</td><td>${s.notes||'—'}</td>
    <td>
      <button class="icon-btn" data-edit-sup="${s.id}">Edit</button>
      <button class="icon-btn danger" data-del-sup="${s.id}">Delete</button>
    </td>
  </tr>`).join('');
  body.querySelectorAll('[data-edit-sup]').forEach(btn=>{
    btn.addEventListener('click', ()=> openSupplierModal(SUPPLIERS.find(s=>s.id===btn.dataset.editSup)));
  });
  body.querySelectorAll('[data-del-sup]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirm('Delete this supplier?')){
        db.collection('suppliers').doc(btn.dataset.delSup).delete().then(loadSuppliers);
      }
    });
  });
}

document.getElementById('openNewSupplierModal').addEventListener('click', ()=> openSupplierModal(null));

function openSupplierModal(s){
  document.getElementById('supplierModalTitle').textContent = s ? 'Edit Supplier' : 'New Supplier';
  document.getElementById('supplierModalId').value = s ? s.id : '';
  document.getElementById('supplierName').value = s ? s.name : '';
  document.getElementById('supplierContact').value = s ? (s.contact||'') : '';
  document.getElementById('supplierNotes').value = s ? (s.notes||'') : '';
  openModal('supplierModal');
}

document.getElementById('confirmSupplier').addEventListener('click', ()=>{
  const id = document.getElementById('supplierModalId').value;
  const name = document.getElementById('supplierName').value.trim();
  const contact = document.getElementById('supplierContact').value.trim();
  const notes = document.getElementById('supplierNotes').value.trim();
  if(!name) return;
  const data = {name, contact, notes};
  const op = id ? db.collection('suppliers').doc(id).update(data) : db.collection('suppliers').add(data);
  op.then(()=>{ closeModal('supplierModal'); loadSuppliers(); });
});

// ---------- Manage Access (admin) ----------
function loadAccessList(){
  db.collection('roles').get().then(snap=>{
    const body = document.getElementById('accessBody');
    const rows = [];
    snap.forEach(doc=>{
      rows.push(`<tr>
        <td>${doc.id}</td>
        <td><span class="role-badge ${doc.data().role}">${doc.data().role.toUpperCase()}</span></td>
        <td><button class="icon-btn danger" data-remove-role="${doc.id}">Remove</button></td>
      </tr>`);
    });
    body.innerHTML = rows.join('');
    body.querySelectorAll('[data-remove-role]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(confirm('Remove access for ' + btn.dataset.removeRole + '?')){
          db.collection('roles').doc(btn.dataset.removeRole).delete().then(loadAccessList);
        }
      });
    });
  });
}

document.getElementById('grantAccessBtn').addEventListener('click', ()=>{
  const email = document.getElementById('accessEmail').value.trim();
  const role = document.getElementById('accessRole').value;
  if(!email) return;
  db.collection('roles').doc(email).set({role}).then(()=>{
    document.getElementById('accessEmail').value = '';
    loadAccessList();
  });
});

// ---------- Export to Excel ----------
function downloadWorkbook(rows, sheetName, filenamePrefix){
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const dateStr = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
}

function exportInventory(){
  const rows = ITEMS.map(it=>({
    SL: it.sl, Type: it.type, Color: it.color||'', Thickness: it.thickness,
    Stock: it.stock, 'Unit Price': it.price||0, 'Reorder Level': reorderLevelOf(it),
    Value: (Number(it.stock)||0) * (Number(it.price)||0)
  }));
  downloadWorkbook(rows, 'Inventory', 'Board_Stock');
}
document.getElementById('exportInventoryBtn').addEventListener('click', exportInventory);
document.getElementById('exportItemsBtn').addEventListener('click', exportInventory);

document.getElementById('downloadTemplateBtn').addEventListener('click', ()=>{
  const sample = [
    {Type:'MDF', Color:'', Thickness:'18 mm', Stock:0, Price:0},
    {Type:'MDF Melamine', Color:'White', Thickness:'12 mm', Stock:0, Price:0}
  ];
  downloadWorkbook(sample, 'Template', 'Board_Stock_Import_Template');
});

document.getElementById('exportHistoryBtn').addEventListener('click', ()=>{
  db.collection('transactions').orderBy('createdAt','desc').limit(1000).get().then(snap=>{
    const rows = [];
    snap.forEach(doc=>{
      const d = doc.data();
      rows.push({
        Date: d.date||'', SL: d.sl, Type: d.type, Color: d.color||'', Thickness: d.thickness,
        Change: d.change, Supplier: d.supplier||'', By: d.by||''
      });
    });
    downloadWorkbook(rows, 'History', 'Usage_History');
  });
});

// ---------- Print ----------
document.getElementById('printInventoryBtn').addEventListener('click', ()=> window.print());
document.getElementById('printReportsBtn').addEventListener('click', ()=> window.print());

// ---------- Bulk Import from Excel ----------
document.getElementById('bulkImportFile').addEventListener('change', function(e){
  const file = e.target.files[0];
  if(!file) return;
  const note = document.getElementById('bulkImportNote');
  note.style.display = 'block';
  note.textContent = 'Reading file...';

  const reader = new FileReader();
  reader.onload = function(evt){
    try{
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});

      if(rows.length === 0){
        note.textContent = 'No rows found in the file.';
        return;
      }
      if(rows.length > 490){
        note.textContent = 'Too many rows in one file (max ~490). Please split into smaller files.';
        return;
      }

      let nextSl = ITEMS.length ? Math.max(...ITEMS.map(i=>i.sl)) + 1 : 1;
      const batch = db.batch();
      let added = 0;

      rows.forEach(r=>{
        const type = String(r.Type ?? r.type ?? '').trim();
        const color = String(r.Color ?? r.color ?? '').trim();
        const thickness = String(r.Thickness ?? r.thickness ?? '').trim();
        const stock = parseFloat(r.Stock ?? r.stock ?? 0) || 0;
        const price = parseFloat(r.Price ?? r.price ?? 0) || 0;
        if(!type) return;
        const ref = db.collection('items').doc(String(nextSl));
        batch.set(ref, {sl: nextSl, page: null, type, color, thickness, stock, price, reorder_level: DEFAULT_LOW_STOCK});
        nextSl++;
        added++;
      });

      batch.commit().then(()=>{
        note.textContent = `✓ Imported ${added} item(s) successfully.`;
        document.getElementById('bulkImportFile').value = '';
        loadItems();
      });
    } catch(err){
      note.textContent = 'Could not read this file. Make sure it\'s a valid Excel/CSV file with Type, Color, Thickness, Stock columns.';
    }
  };
  reader.readAsArrayBuffer(file);
});

// ---------- Charts (Reports view) ----------
function renderCharts(){
  const palette = ['#E8791A','#3A7D44','#B23A2E','#B9862E','#6B6558','#C25E0E','#8A9A8C'];

  // Stock by Type
  const byType = {};
  ITEMS.forEach(it=>{ byType[it.type] = (byType[it.type]||0) + (Number(it.stock)||0); });
  const typeLabels = Object.keys(byType);
  const typeData = Object.values(byType);

  if(charts.byType) charts.byType.destroy();
  charts.byType = new Chart(document.getElementById('chartByType'), {
    type: 'bar',
    data: { labels: typeLabels, datasets: [{ label:'Stock', data: typeData, backgroundColor:'#E8791A' }] },
    options: { plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });

  // Stock In vs Out — last 30 days
  const today = new Date();
  const days = [];
  for(let i=29;i>=0;i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    days.push(d.toISOString().slice(0,10));
  }
  const inByDay = {}, outByDay = {};
  days.forEach(d=>{ inByDay[d]=0; outByDay[d]=0; });
  HISTORY_CACHE.forEach(tx=>{
    if(!tx.date || !(tx.date in inByDay)) return;
    if(tx.change > 0) inByDay[tx.date] += tx.change;
    else outByDay[tx.date] += Math.abs(tx.change);
  });

  if(charts.trend) charts.trend.destroy();
  charts.trend = new Chart(document.getElementById('chartTrend'), {
    type: 'line',
    data: {
      labels: days.map(d=>d.slice(5)),
      datasets: [
        { label:'Stock In', data: days.map(d=>inByDay[d]), borderColor:'#3A7D44', backgroundColor:'rgba(58,125,68,0.1)', tension:0.3 },
        { label:'Stock Out', data: days.map(d=>outByDay[d]), borderColor:'#B23A2E', backgroundColor:'rgba(178,58,46,0.1)', tension:0.3 }
      ]
    },
    options: { scales:{y:{beginAtZero:true}} }
  });

  // Value by Type
  const valueByType = {};
  ITEMS.forEach(it=>{
    valueByType[it.type] = (valueByType[it.type]||0) + (Number(it.stock)||0) * (Number(it.price)||0);
  });
  if(charts.value) charts.value.destroy();
  charts.value = new Chart(document.getElementById('chartValue'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(valueByType),
      datasets: [{ data: Object.values(valueByType), backgroundColor: palette }]
    },
    options: { plugins:{legend:{position:'right'}} }
  });
}
