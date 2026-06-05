'use strict';
let currentUser = null;

document.getElementById('loginBtn').addEventListener('click', async () => {
  const role = document.getElementById('roleSelect').value;
  const err  = document.getElementById('loginError');
  if (!role) { err.textContent = 'Lutfen bir rol seciniz.'; err.classList.remove('d-none'); return; }
  const demoUsers = {
    Admin:              { email: 'admin@restoran.com',    password: 'Admin@123' },
    DepoSorumlusu:      { email: 'depo@restoran.com',     password: 'Depo@123' },
    SatinAlmaSorumlusu: { email: 'satin@restoran.com',    password: 'Satin@123' },
    Yonetici:           { email: 'yonetici@restoran.com', password: 'Yonetici@123' },
  };
  err.classList.add('d-none');
  document.getElementById('loginBtn').disabled = true;
  try {
    const data = await api.login(demoUsers[role].email, demoUsers[role].password);
    setToken(data.token); currentUser = data.user;
    applyRole(currentUser.roleName);
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('appScreen').classList.remove('d-none');
    navigateTo('dashboard');
  } catch (e) {
    err.textContent = e.message || 'Giris basarisiz.';
    err.classList.remove('d-none');
  } finally { document.getElementById('loginBtn').disabled = false; }
});

document.getElementById('roleSwitcher').addEventListener('change', async (e) => {
  const role = e.target.value;
  const demoUsers = {
    Admin:              { email: 'admin@restoran.com',    password: 'Admin@123' },
    DepoSorumlusu:      { email: 'depo@restoran.com',     password: 'Depo@123' },
    SatinAlmaSorumlusu: { email: 'satin@restoran.com',    password: 'Satin@123' },
    Yonetici:           { email: 'yonetici@restoran.com', password: 'Yonetici@123' },
  };
  try {
    const data = await api.login(demoUsers[role].email, demoUsers[role].password);
    setToken(data.token); currentUser = data.user;
  } catch (_) { currentUser = { ...currentUser, roleName: role }; }
  applyRole(role);
  navigateTo(document.querySelector('.nav-item.active')?.dataset.page || 'dashboard');
});

function applyRole(role) {
  document.body.className = document.body.className.replace(/role-\S+/g, '').trim();
  document.body.classList.add('role-' + role);
  document.getElementById('sidebarUserRole').textContent = ({Admin:'Admin',DepoSorumlusu:'Depo Sorumlusu',SatinAlmaSorumlusu:'Satin Alma Sorumlusu',Yonetici:'Yonetici'})[role] || role;
  document.getElementById('sidebarUserName').textContent = currentUser ? currentUser.fullName : '';
  document.getElementById('roleSwitcher').value = role;
  setVisible('btnYeniTalep',    ['Admin','DepoSorumlusu'].includes(role));
  setVisible('btnYeniSiparis',  ['Admin','SatinAlmaSorumlusu'].includes(role));
  setVisible('btnYeniUrun',     ['Admin','DepoSorumlusu'].includes(role));
  setVisible('btnYeniTedarikci', role === 'Admin');
}
function setVisible(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }

document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
});
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
  document.querySelector('.nav-item[data-page="' + page + '"]')?.classList.add('active');
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('d-none'));
  document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1))?.classList.remove('d-none');
  ({dashboard:renderDashboard,stok:renderStok,talepler:renderTalepler,siparisler:renderSiparisler,tedarikciler:renderTedarikciler})[page]?.();
}

async function renderDashboard() {
  document.getElementById('dashWelcome').textContent = 'Hos geldiniz, ' + (currentUser?.fullName || '');
  try {
    const [products, requests, orders] = await Promise.all([api.getProducts(), api.getRequests(), api.getOrders()]);
    const critical = products.filter(p => parseFloat(p.quantity) < parseFloat(p.reorderLevel));
    document.getElementById('statKritik').textContent  = critical.length;
    document.getElementById('statUrun').textContent    = products.length;
    document.getElementById('statTalep').textContent   = requests.filter(r => r.status === 'Pending').length;
    document.getElementById('statSiparis').textContent = orders.filter(o => ['Pending','Partial'].includes(o.status)).length;
    const list = document.getElementById('dashCriticalList');
    const box  = document.getElementById('dashCriticalBox');
    list.innerHTML = '';
    if (!critical.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    critical.forEach(p => list.insertAdjacentHTML('beforeend',
      '<div class="critical-item"><div class="critical-item-left"><div class="item-name">' + p.productName + '</div><div class="item-cat">' + p.categoryName + '</div></div>' +
      '<div class="critical-item-right"><div class="item-qty">' + p.quantity + ' ' + p.unit + '</div><div class="item-min">Min: ' + p.reorderLevel + ' ' + p.unit + '</div></div></div>'));
  } catch(e) { showToast('Dashboard yuklenemedi: ' + e.message, 'error'); }
}

async function renderStok() {
  try {
    const products = await api.getProducts();
    const critical = products.filter(p => parseFloat(p.quantity) < parseFloat(p.reorderLevel));
    document.getElementById('stokSubtitle').textContent = products.length + ' urun, ' + critical.length + ' kritik stok';
    const box = document.getElementById('stokCriticalBox');
    if (critical.length) { box.style.display = ''; document.getElementById('stokCriticalMsg').textContent = critical.length + ' urun kritik seviyede.'; }
    else box.style.display = 'none';
    const role = currentUser?.roleName, tbody = document.getElementById('stokTableBody');
    tbody.innerHTML = '';
    products.forEach(p => {
      const isCrit = parseFloat(p.quantity) < parseFloat(p.reorderLevel);
      const badge  = isCrit ? '<span class="badge-kritik">KRITIK</span>' : '<span class="badge-normal">NORMAL</span>';
      const priceCell = role === 'DepoSorumlusu' ? '<td class="cost-col">-</td>' : '<td class="cost-col">' + (p.unitPrice != null ? Number(p.unitPrice).toFixed(2) + ' TL' : '-') + '</td>';
      const canEdit = ['Admin','DepoSorumlusu'].includes(role);
      const actions = canEdit ? '<button class="btn-icon del" onclick="deleteProduct(' + p.productID + ')"><i class="bi bi-trash"></i></button>' : '-';
      tbody.insertAdjacentHTML('beforeend', '<tr><td><strong>' + p.productName + '</strong></td><td>' + p.categoryName + '</td><td>' + p.quantity + ' ' + p.unit + '</td><td>' + p.reorderLevel + ' ' + p.unit + '</td><td>' + badge + '</td>' + priceCell + '<td class="text-end">' + actions + '</td></tr>');
    });
  } catch(e) { showToast('Stok yuklenemedi: ' + e.message, 'error'); }
}
async function deleteProduct(id) {
  if (!confirm('Bu urunu silmek istediginize emin misiniz?')) return;
  try { await api.deleteProduct(id); showToast('Urun silindi.', 'success'); renderStok(); } catch(e) { showToast(e.message, 'error'); }
}
async function openYeniUrunModal() {
  try { const cats = await api.getCategories(); const sel = document.getElementById('newProductCategory'); sel.innerHTML = cats.map(c => '<option value="' + c.categoryID + '">' + c.categoryName + '</option>').join(''); } catch(_) {}
  openModal('modalYeniUrun');
}
function toggleExpiryField() { document.getElementById('expiryFieldWrap').classList.toggle('d-none', !document.getElementById('newProductPerishable').checked); }
async function saveNewProduct() {
  const productName = document.getElementById('newProductName').value.trim();
  const categoryID  = parseInt(document.getElementById('newProductCategory').value);
  const quantity    = parseFloat(document.getElementById('newProductQty').value) || 0;
  const unit        = document.getElementById('newProductUnit').value;
  const reorderLevel= parseFloat(document.getElementById('newProductMin').value) || 0;
  const unitPrice   = parseFloat(document.getElementById('newProductPrice').value) || 0;
  const isPerishable= document.getElementById('newProductPerishable').checked;
  const expiryDate  = document.getElementById('newProductExpiry').value || null;
  if (!productName) { showToast('Urun adi zorunludur.', 'error'); return; }
  if (isPerishable && !expiryDate) { showToast('Bozulabilir urunler icin SKT zorunludur.', 'error'); return; }
  try {
    await api.createProduct({productName,categoryID,unit,unitPrice,isPerishable,quantity,reorderLevel,expiryDate});
    closeModal('modalYeniUrun');
    ['newProductName','newProductQty','newProductMin','newProductPrice','newProductExpiry'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('newProductPerishable').checked = false;
    document.getElementById('expiryFieldWrap').classList.add('d-none');
    showToast('Urun eklendi.', 'success'); renderStok();
  } catch(e) { showToast(e.message, 'error'); }
}

async function renderTalepler() {
  try {
    const [requests, products] = await Promise.all([api.getRequests(), api.getProducts()]);
    const pending = requests.filter(r => r.status === 'Pending').length;
    document.getElementById('talepSubtitle').textContent = requests.length + ' talep, ' + pending + ' onay bekliyor';
    const role = currentUser?.roleName, tbody = document.getElementById('talepTableBody');
    tbody.innerHTML = '';
    requests.forEach(r => {
      const badge = {Approved:'<span class="badge-approved">ONAYLANDI</span>',Rejected:'<span class="badge-rejected">REDDEDILDI</span>',Pending:'<span class="badge-pending">BEKLEMEDE</span>'}[r.status] || r.status;
      const canApprove = ['Admin','Yonetici'].includes(role) && r.status === 'Pending';
      const actions = canApprove ? '<button class="btn-onayla" onclick="approveTalep(' + r.requestID + ')"><i class="bi bi-check-circle"></i> Onayla</button>' : '-';
      tbody.insertAdjacentHTML('beforeend', '<tr><td><strong>' + r.productName + '</strong></td><td>' + r.requestedQty + ' ' + r.unit + '</td><td>' + r.requesterName + '</td><td>' + (r.note||'-') + '</td><td>' + badge + '</td><td>' + (r.approverName||'-') + '</td><td class="text-end">' + actions + '</td></tr>');
    });
    const sel = document.getElementById('talepUrun');
    sel.innerHTML = products.map(p => '<option value="' + p.productID + '" data-unit="' + p.unit + '">' + p.productName + '</option>').join('');
    updateTalepUnit();
  } catch(e) { showToast('Talepler yuklenemedi: ' + e.message, 'error'); }
}
function updateTalepUnit() { const sel=document.getElementById('talepUrun'); document.getElementById('talepUnitLabel').textContent = sel.options[sel.selectedIndex]?.dataset.unit || 'adet'; }
async function approveTalep(id) {
  try { await api.resolveRequest(id, {status:'Approved'}); showToast('Talep onaylandi.','success'); renderTalepler(); renderDashboard(); } catch(e) { showToast(e.message,'error'); }
}
async function saveTalep() {
  const productID = parseInt(document.getElementById('talepUrun').value);
  const requestedQty = parseFloat(document.getElementById('talepMiktar').value);
  const note = document.getElementById('talepNeden').value.trim();
  if (!productID || !requestedQty || requestedQty <= 0) { showToast('Urun ve miktar zorunludur.','error'); return; }
  try {
    await api.createRequest({productID,requestedQty,note});
    closeModal('modalYeniTalep');
    document.getElementById('talepMiktar').value = ''; document.getElementById('talepNeden').value = '';
    showToast('Talep olusturuldu.','success'); renderTalepler(); renderDashboard();
  } catch(e) { showToast(e.message,'error'); }
}

async function renderSiparisler() {
  try {
    const [orders, requests, suppliers] = await Promise.all([api.getOrders(), api.getRequests(), api.getSuppliers()]);
    const active = orders.filter(o => ['Pending','Partial'].includes(o.status)).length;
    document.getElementById('siparisSubtitle').textContent = orders.length + ' siparis, ' + active + ' aktif';
    const role = currentUser?.roleName, tbody = document.getElementById('siparisTableBody');
    tbody.innerHTML = '';
    orders.forEach(o => {
      const badge = {Pending:'<span class="badge-siparis">SIPARIS VERILDI</span>',Partial:'<span class="badge-partial">KISMI TESLIMAT</span>',Received:'<span class="badge-teslim">TESLIM ALINDI</span>',Cancelled:'<span class="badge-rejected">IPTAL</span>'}[o.status] || o.status;
      const needsAdmin = o.requiresAdminApproval && !o.approvedBy;
      const canAdminApprove = role === 'Admin' && needsAdmin;
      const canReceive = ['Admin','DepoSorumlusu'].includes(role) && o.status === 'Pending' && !needsAdmin;
      let actions = '-';
      if (canAdminApprove) actions = '<button class="btn-onayla" onclick="adminApproveOrder(' + o.orderID + ')"><i class="bi bi-shield-check"></i> Admin Onayla</button>';
      else if (canReceive) actions = '<button class="btn-teslim" onclick="openTeslimModal(' + o.orderID + ')"><i class="bi bi-check-circle"></i> Teslim Al</button>';
      tbody.insertAdjacentHTML('beforeend', '<tr><td><strong>' + o.supplierName + '</strong></td><td>' + Number(o.totalAmount||0).toFixed(2) + ' TL</td><td>' + o.supplierName + '</td><td>' + o.createdBy + '</td><td>' + badge + (needsAdmin?' <small class="text-danger">Admin onayi bekleniyor</small>':'') + '</td><td>' + (o.approvedBy||'-') + '</td><td class="text-end">' + actions + '</td></tr>');
    });
    const reqSel = document.getElementById('siparisRequestSelect');
    reqSel.innerHTML = '<option value="">Talep seciniz</option>';
    requests.filter(r => r.status === 'Approved').forEach(r => reqSel.insertAdjacentHTML('beforeend', '<option value="' + r.requestID + '" data-product="' + r.productName + '" data-qty="' + r.requestedQty + '" data-unit="' + r.unit + '">' + r.productName + ' - ' + r.requestedQty + ' ' + r.unit + '</option>'));
    const supSel = document.getElementById('siparisTedarikci');
    supSel.innerHTML = '<option value="">Tedarikci seciniz</option>';
    suppliers.filter(s => s.isActive).forEach(s => supSel.insertAdjacentHTML('beforeend', '<option value="' + s.supplierID + '">' + s.companyName + '</option>'));
  } catch(e) { showToast('Siparisler yuklenemedi: ' + e.message, 'error'); }
}
function updateSiparisPreview() {
  const sel = document.getElementById('siparisRequestSelect'), opt = sel.options[sel.selectedIndex], preview = document.getElementById('siparisPreview');
  if (!opt?.value) { preview.classList.add('d-none'); return; }
  document.getElementById('previewUrun').textContent = opt.dataset.product;
  document.getElementById('previewMiktar').textContent = opt.dataset.qty + ' ' + opt.dataset.unit;
  preview.classList.remove('d-none');
}
async function adminApproveOrder(id) {
  try { await api.adminApprove(id); showToast('Siparis Admin tarafindan onaylandi.','success'); renderSiparisler(); } catch(e) { showToast(e.message,'error'); }
}
async function openTeslimModal(orderID) {
  try {
    const order = await api.getOrderDetails(orderID);
    let lines = '';
    order.details.forEach(d => {
      const rem = Math.max(0, d.orderedQty - d.receivedQty);
      lines += '<div class="mb-3 p-2 border rounded"><div class="fw-semibold mb-1">' + d.productName + ' <small class="text-muted">(Kalan: ' + rem + ' ' + d.unit + ')</small></div>' +
        '<input type="number" class="form-control form-control-sm" id="recv_' + d.orderDetailID + '" value="' + rem + '" min="0" max="' + rem + '" step="0.01" />' +
        (d.isPerishable ? '<input type="date" class="form-control form-control-sm mt-1" id="exp_' + d.orderDetailID + '" /><small class="text-danger">SKT zorunlu</small>' : '') + '</div>';
    });
    const body = document.getElementById('teslimModalBody');
    body.innerHTML = lines; body.dataset.orderid = orderID;
    body.dataset.details = JSON.stringify(order.details.map(d => ({orderDetailID:d.orderDetailID,isPerishable:d.isPerishable})));
    openModal('modalTeslim');
  } catch(e) { showToast(e.message,'error'); }
}
async function confirmTeslim() {
  const body = document.getElementById('teslimModalBody');
  const orderID = parseInt(body.dataset.orderid);
  const details = JSON.parse(body.dataset.details || '[]');
  const deliveries = details.map(d => ({orderDetailID:d.orderDetailID, receivedQty:parseFloat(document.getElementById('recv_'+d.orderDetailID)?.value||0), expiryDate:document.getElementById('exp_'+d.orderDetailID)?.value||null}));
  for (const d of deliveries) { const det = details.find(x => x.orderDetailID === d.orderDetailID); if (det?.isPerishable && !d.expiryDate) { showToast('Bozulabilir urunler icin SKT zorunludur.','error'); return; } }
  try { const r = await api.receiveOrder(orderID,{deliveries,receivedDate:new Date().toISOString()}); closeModal('modalTeslim'); showToast(r.message,'success'); renderSiparisler(); renderDashboard(); } catch(e) { showToast(e.message,'error'); }
}
async function saveSiparis() {
  const requestID = parseInt(document.getElementById('siparisRequestSelect').value);
  const supplierID = parseInt(document.getElementById('siparisTedarikci').value);
  if (!requestID) { showToast('Onayli talep seciniz.','error'); return; }
  if (!supplierID) { showToast('Tedarikci seciniz.','error'); return; }
  const opt = document.getElementById('siparisRequestSelect').options[document.getElementById('siparisRequestSelect').selectedIndex];
  let productID = null, unitPrice = 0;
  try { const prods = await api.getProducts(); const prod = prods.find(p => p.productName === opt.dataset.product); if (prod) { productID = prod.productID; unitPrice = prod.unitPrice || 0; } } catch(_) {}
  if (!productID) { showToast('Urun esleştirilemedi.','error'); return; }
  try { const r = await api.createOrder({supplierID,requestID,items:[{productID,orderedQty:parseFloat(opt.dataset.qty),unitPrice}]}); closeModal('modalYeniSiparis'); showToast(r.message, r.requiresAdminApproval?'':'success'); renderSiparisler(); renderDashboard(); } catch(e) { showToast(e.message,'error'); }
}

async function renderTedarikciler() {
  try {
    const suppliers = await api.getSuppliers();
    document.getElementById('tedarikciSubtitle').textContent = suppliers.length + ' tedarikci';
    const tbody = document.getElementById('tedarikciTableBody');
    tbody.innerHTML = '';
    suppliers.forEach(s => {
      const sc = s.perfScore >= 80 ? 'text-success' : s.perfScore >= 60 ? 'text-warning' : 'text-danger';
      const sb = s.isActive ? '<span class="badge-normal">AKTIF</span>' : '<span class="badge-rejected">PASIF</span>';
      tbody.insertAdjacentHTML('beforeend', '<tr><td><strong>' + s.companyName + '</strong></td><td>' + s.taxNumber + '</td><td>' + (s.contactName||'-') + '<br><small class="text-muted">' + (s.phone||'') + '</small></td><td><span class="' + sc + ' fw-bold">' + s.perfScore + '/100</span></td><td>' + sb + '</td><td class="text-end"><button class="btn-icon del" onclick="deleteSupplier(' + s.supplierID + ')"><i class="bi bi-trash"></i></button></td></tr>');
    });
  } catch(e) { showToast('Tedarikciler yuklenemedi: ' + e.message, 'error'); }
}
async function deleteSupplier(id) {
  if (!confirm('Bu tedarkciyi silmek istediginize emin misiniz?')) return;
  try { await api.deleteSupplier(id); showToast('Tedarikci silindi.','success'); renderTedarikciler(); } catch(e) { showToast(e.message,'error'); }
}
async function saveTedarikci() {
  const companyName = document.getElementById('newSupplierName').value.trim();
  const taxNumber   = document.getElementById('newSupplierTax').value.trim();
  const contactName = document.getElementById('newSupplierContact').value.trim();
  const phone       = document.getElementById('newSupplierPhone').value.trim();
  const email       = document.getElementById('newSupplierEmail').value.trim();
  if (!companyName || !taxNumber) { showToast('Firma adi ve vergi no zorunludur.','error'); return; }
  try { await api.createSupplier({companyName,taxNumber,contactName,phone,email}); closeModal('modalYeniTedarikci'); ['newSupplierName','newSupplierTax','newSupplierContact','newSupplierPhone','newSupplierEmail'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; }); showToast('Tedarikci eklendi.','success'); renderTedarikciler(); } catch(e) { showToast(e.message,'error'); }
}

function openModal(id)  { document.getElementById(id)?.classList.remove('d-none'); }
function closeModal(id) { document.getElementById(id)?.classList.add('d-none'); }
document.querySelectorAll('.modal-backdrop-custom').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('d-none'); }));
function showToast(msg, type) { const d=document.createElement('div'); d.className='toast-custom '+(type||''); d.textContent=msg; document.getElementById('toastContainer').appendChild(d); setTimeout(()=>d.remove(),3500); }
function exportPDF() { showToast('PDF disa aktarma ozelligi yakindan eklenecek.',''); }
