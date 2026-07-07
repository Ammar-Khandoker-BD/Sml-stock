const LOW_STOCK_THRESHOLD = 5;
let ITEMS = [];
let currentUserEmail = '';
let currentRole = 'staff';

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
    if(currentRole === 'admin') loadAccessList();
  });
});

document.getElementById('logoutBtn').addEventListener('click', ()=> auth.signOut());

// ---------- Nav switching ----------
document.querySelectorAll('.nav-item').forEach(el=>{
  el.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    el.classList.add('active');
    const view = el.dataset.view;
    ['inventory','history','manage-items','manage-access'].forEach(v=>{
      document.getElementById('view-'+v).style.display = (v===view) ? '' : 'none';
    });
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
    if(currentRole === 'admin') renderManageItems();
  });
}

document.getElementById('importBtn').addEventListener('click', ()=>{
  fetch('items-seed.json').then(r=>r.json()).then(seed=>{
    const batch = db.batch();
    seed.forEach(it=>{
      const ref = db.collection('items').doc(String(it.sl));
      batch.set(ref, it);
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

function renderTable(){
  const q = document.getElementById('searchInput').value.toLowerCase();
  const typeF = document.getElementById('typeFilter').value;
  const body = document.getElementById('itemsBody');
  const filtered = ITEMS.filter(it=>{
    const hay = `${it.type} ${it.color||''} ${it.thickness}`.toLowerCase();
    return hay.includes(q) && (!typeF || it.type===typeF);
  });

  document.getElementById('statTotal').textContent = ITEMS.length;
  document.getElementById('statStock').textContent = ITEMS.reduce((s,i)=>s+(Number(i.stock)||0),0);
  document.getElementById('statLow').textContent = ITEMS.filter(i=>(Number(i.stock)||0) < LOW_STOCK_THRESHOLD).length;

  document.getElementById('itemsEmpty').style.display = filtered.length ? 'none' : 'block';

  body.innerHTML = filtered.map(it=>{
    const stock = Number(it.stock)||0;
    const low = stock < LOW_STOCK_THRESHOLD;
    const bars = Math.max(1, Math.min(10, Math.ceil(stock/5)));
    const gaugeClass = stock===0 ? 'empty' : (low ? 'low' : '');
    const barsHtml = Array.from({length:bars}).map(()=>'<div></div>').join('');
    return `<tr>
      <td class="mono">${it.sl}</td>
      <td>${it.type}</td>
      <td>${it.color||'—'}</td>
      <td>${it.thickness}</td>
      <td><span class="qty-badge">${stock}</span>${low?'<span class="low-tag">LOW</span>':''}</td>
      <td><div class="stack-gauge ${gaugeClass}">${barsHtml}</div></td>
    </tr>`;
  }).join('');
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
  if(!itemId || !qty || qty<=0) return;
  applyTransaction(itemId, qty, date);
  closeModal('addModal');
  document.getElementById('addQty').value = '';
});

document.getElementById('confirmUse').addEventListener('click', ()=>{
  const itemId = document.getElementById('useItemSelect').value;
  const qty = parseFloat(document.getElementById('useQty').value);
  const date = document.getElementById('useDate').value;
  if(!itemId || !qty || qty<=0) return;
  applyTransaction(itemId, -qty, date);
  closeModal('useModal');
  document.getElementById('useQty').value = '';
});

function applyTransaction(itemId, delta, date){
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
      change: delta, date, by: currentUserEmail, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(()=>{ loadItems(); loadHistory(); });
  });
}

// ---------- History ----------
function loadHistory(){
  db.collection('transactions').orderBy('createdAt','desc').limit(200).get().then(snap=>{
    const body = document.getElementById('historyBody');
    const rows = [];
    snap.forEach(doc=>{
      const d = doc.data();
      const positive = d.change > 0;
      rows.push(`<tr>
        <td class="mono">${d.date||'—'}</td>
        <td>SL ${d.sl}</td>
        <td>${d.type} ${d.color?('— '+d.color):''} — ${d.thickness}</td>
        <td class="mono" style="color:${positive?'var(--green)':'var(--red)'}">${positive?'+':''}${d.change}</td>
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
  openModal('itemModal');
}

document.getElementById('confirmItem').addEventListener('click', ()=>{
  const id = document.getElementById('itemModalId').value;
  const type = document.getElementById('itemType').value.trim();
  const color = document.getElementById('itemColor').value.trim();
  const thickness = document.getElementById('itemThickness').value.trim();
  const stock = parseFloat(document.getElementById('itemStock').value) || 0;
  if(!type || !thickness) return;

  if(id){
    db.collection('items').doc(id).update({type, color, thickness, stock}).then(()=>{
      closeModal('itemModal'); loadItems();
    });
  } else {
    const nextSl = ITEMS.length ? Math.max(...ITEMS.map(i=>i.sl)) + 1 : 1;
    db.collection('items').doc(String(nextSl)).set({sl: nextSl, page: null, type, color, thickness, stock}).then(()=>{
      closeModal('itemModal'); loadItems();
    });
  }
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
