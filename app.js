/* =========================================================================
   FieldStock — Farm Equipment Rental Management System
   Simple frontend logic. Uses the same API actions / JSON fields as the
   Google Apps Script backend (Code.gs): list, get, create, update, delete,
   rent, return. Nothing here changes those field names or the payloads.
   ========================================================================= */

let STATE = {
  equipment: [],
  isAdmin: false,
};

/* ---------------- Simple placeholder image (no gradients) ---------------- */
const CATEGORY_COLOR = {
  "Tractors": "#3B6EA5",
  "Harvesters": "#3B6EA5",
  "Tillage Equipment": "#3B6EA5",
  "Planting Equipment": "#3B6EA5",
  "Irrigation": "#3B6EA5",
  "Sprayers": "#3B6EA5",
  "Trailers & Transport": "#3B6EA5",
  "Post-Harvest": "#3B6EA5",
  "Power Tools": "#3B6EA5",
};
function placeholderImage(category){
  const color = CATEGORY_COLOR[category] || "#8A8A8A";
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#F2F2F2"/>
    <rect width="400" height="300" fill="none" stroke="${color}" stroke-width="4"/>
    <text x="200" y="150" font-size="18" fill="${color}" text-anchor="middle"
      font-family="Arial" dominant-baseline="middle">${escapeHtml(category || "Equipment")}</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/* =========================================================================
   API LAYER — calls the live Apps Script backend (or demo/local fallback).
   Actions and payload field names are unchanged from the backend contract.
   ========================================================================= */
async function apiCall(action, payload){
  if (CONFIG.DEMO_MODE){
    return demoHandler(action, payload);
  }
  if (!CONFIG.API_URL){
    throw new Error("CONFIG.API_URL is not set.");
  }
  if (action === "list" || action === "get"){
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set("action", action);
    if (payload && payload.id) url.searchParams.set("id", payload.id);
    const res = await fetch(url.toString(), { method: "GET" });
    return res.json();
  }
  // POST — text/plain avoids CORS preflight against Apps Script
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

function recalcStatus(item){
  item.rentedQuantity = item.totalQuantity - item.availableQuantity;
  item.status = item.availableQuantity > 0 ? "Available" : "Rented";
  return item;
}

/* ---------------- Optional local demo fallback (unused when DEMO_MODE=false) ---------------- */
function loadDemoData(){
  const raw = localStorage.getItem("fieldstock_demo_data");
  return raw ? JSON.parse(raw) : [];
}
function saveDemoData(list){
  localStorage.setItem("fieldstock_demo_data", JSON.stringify(list));
}
function demoHandler(action, payload){
  let list = loadDemoData();
  switch(action){
    case "list": return { ok:true, data:list };
    case "get": return { ok:true, data:list.find(e=>e.id===payload.id) || null };
    case "create": {
      const id = "EQ" + String(Date.now()).slice(-6);
      const item = recalcStatus({ id, createdAt:new Date().toISOString(), ...payload });
      list.push(item); saveDemoData(list);
      return { ok:true, data:item };
    }
    case "update": {
      const idx = list.findIndex(e=>e.id===payload.id);
      if (idx === -1) return { ok:false, error:"Equipment not found" };
      list[idx] = recalcStatus({ ...list[idx], ...payload });
      saveDemoData(list);
      return { ok:true, data:list[idx] };
    }
    case "delete": {
      list = list.filter(e=>e.id!==payload.id);
      saveDemoData(list);
      return { ok:true };
    }
    case "rent": {
      const idx = list.findIndex(e=>e.id===payload.id);
      if (idx === -1) return { ok:false, error:"Equipment not found" };
      const item = list[idx];
      if (payload.quantity > item.availableQuantity) return { ok:false, error:"Not enough units available" };
      item.availableQuantity -= payload.quantity;
      recalcStatus(item); saveDemoData(list);
      return { ok:true, data:item };
    }
    case "return": {
      const idx = list.findIndex(e=>e.id===payload.id);
      if (idx === -1) return { ok:false, error:"Equipment not found" };
      const item = list[idx];
      item.availableQuantity = Math.min(item.totalQuantity, item.availableQuantity + payload.quantity);
      recalcStatus(item); saveDemoData(list);
      return { ok:true, data:item };
    }
    default: return { ok:false, error:"Unknown action" };
  }
}

/* ---------------- Simple toast messages ---------------- */
function toast(msg, type="ok"){
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast" + (type==="error" ? " error" : "");
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

/* ---------------- Boot ---------------- */
async function boot(){
  document.getElementById("modeText").textContent = CONFIG.DEMO_MODE ? "Demo Mode" : "Connected to Backend";

  try{
    const res = await apiCall("list");
    STATE.equipment = res.data || [];
  } catch(err){
    toast("Could not load equipment from backend", "error");
    STATE.equipment = [];
  }

  populateCategoryFilter();
  applyFilters();
  renderAdminTable();

  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("availFilter").addEventListener("change", applyFilters);
  document.getElementById("adminSearch").addEventListener("input", renderAdminTable);
}

function populateCategoryFilter(){
  const sel = document.getElementById("categoryFilter");
  sel.querySelectorAll("option:not(:first-child)").forEach(o=>o.remove());
  const cats = [...new Set(STATE.equipment.map(e=>e.category))].sort();
  cats.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

/* ---------------- Filtering & rendering (Catalog) ---------------- */
function applyFilters(){
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const cat = document.getElementById("categoryFilter").value;
  const avail = document.getElementById("availFilter").value;

  let list = STATE.equipment.filter(e=>{
    const matchesQ = !q || [e.name,e.brand,e.model].join(" ").toLowerCase().includes(q);
    const matchesCat = !cat || e.category === cat;
    const matchesAvail = !avail || (avail==="available" ? e.availableQuantity>0 : e.availableQuantity===0);
    return matchesQ && matchesCat && matchesAvail;
  });

  renderGrid(list);
  document.getElementById("resultCount").textContent = `${list.length} of ${STATE.equipment.length} shown`;
}

function renderGrid(list){
  const grid = document.getElementById("equipmentGrid");
  grid.innerHTML = "";
  if (list.length === 0){
    grid.innerHTML = `<p class="empty-state">No equipment matches your search/filters.</p>`;
    return;
  }
  list.forEach(item=>{
    const isAvail = item.availableQuantity > 0;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img class="card-img" src="${item.imageURL || placeholderImage(item.category)}" alt="${escapeHtml(item.name)}"
           onerror="this.src='${placeholderImage(item.category)}'">
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(item.name)}</h3>
        <p class="card-cat">${escapeHtml(item.category)}</p>
        <p class="card-rent">Rent: ₹${Number(item.rentPerDay).toLocaleString()} / day</p>
        <p class="card-status ${isAvail ? 'status-available' : 'status-rented'}">
          ${isAvail ? 'Available' : 'Rented Out'}
        </p>
        <button class="btn btn-blue btn-block" onclick="openDetail('${item.id}')">View Details</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------- Detail modal ---------------- */
function openDetail(id){
  const item = STATE.equipment.find(e=>e.id===id);
  if (!item) return;
  const isAvail = item.availableQuantity > 0;
  const featuresHtml = (item.features||[]).map(f=>`<li>${escapeHtml(f)}</li>`).join("");
  const specsHtml = Object.entries(item.specifications||{})
    .map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("");

  document.getElementById("detailContent").innerHTML = `
    <img class="detail-img" src="${item.imageURL || placeholderImage(item.category)}" alt="${escapeHtml(item.name)}"
         onerror="this.src='${placeholderImage(item.category)}'">
    <div class="detail-info">
      <p class="detail-id">Equipment ID: ${item.id}</p>
      <h2>${escapeHtml(item.name)}</h2>
      <table class="plain-table">
        <tr><td>Category</td><td>${escapeHtml(item.category)}</td></tr>
        <tr><td>Brand</td><td>${escapeHtml(item.brand)}</td></tr>
        <tr><td>Model</td><td>${escapeHtml(item.model)}</td></tr>
        <tr><td>Condition</td><td>${escapeHtml(item.condition)}</td></tr>
        <tr><td>Rent / Day</td><td>₹${Number(item.rentPerDay).toLocaleString()}</td></tr>
        <tr><td>Security Deposit</td><td>₹${Number(item.securityDeposit).toLocaleString()}</td></tr>
        <tr><td>Total Quantity</td><td>${item.totalQuantity}</td></tr>
        <tr><td>Available Quantity</td><td>${item.availableQuantity}</td></tr>
        <tr><td>Rented Quantity</td><td>${item.rentedQuantity}</td></tr>
        <tr><td>Status</td><td class="${isAvail?'status-available':'status-rented'}">${isAvail ? 'Available' : 'Rented Out'}</td></tr>
      </table>

      <p class="detail-desc">${escapeHtml(item.description || "No description provided.")}</p>

      ${featuresHtml ? `<h4>Features</h4><ul class="plain-list">${featuresHtml}</ul>` : ""}
      ${specsHtml ? `<h4>Specifications</h4><table class="plain-table">${specsHtml}</table>` : ""}

      <div class="detail-actions">
        <button class="btn btn-blue" ${isAvail ? "" : "disabled"} onclick="openRent('${item.id}')">Rent Now</button>
        <button class="btn btn-outline" onclick="closeModal('detailOverlay')">Close</button>
      </div>
    </div>
  `;
  openModal("detailOverlay");
}

/* ---------------- Rent flow ---------------- */
function openRent(id){
  const item = STATE.equipment.find(e=>e.id===id);
  if (!item) return;
  closeModal("detailOverlay");
  document.getElementById("r_id").value = item.id;
  document.getElementById("r_equipName").textContent = `${item.name} (₹${item.rentPerDay}/day)`;
  document.getElementById("r_name").value = "";
  document.getElementById("r_phone").value = "";
  document.getElementById("r_qty").value = 1;
  document.getElementById("r_qty").max = item.availableQuantity;
  document.getElementById("r_days").value = 1;
  updateRentTotal();
  ["r_qty","r_days"].forEach(fid=>document.getElementById(fid).oninput = updateRentTotal);
  openModal("rentOverlay");
}
function updateRentTotal(){
  const item = STATE.equipment.find(e=>e.id===document.getElementById("r_id").value);
  const qty = Number(document.getElementById("r_qty").value)||0;
  const days = Number(document.getElementById("r_days").value)||0;
  const total = item ? item.rentPerDay*qty*days : 0;
  document.getElementById("r_total").textContent = `₹${total.toLocaleString()}`;
}
async function submitRent(evt){
  evt.preventDefault();
  const id = document.getElementById("r_id").value;
  const item = STATE.equipment.find(e=>e.id===id);
  const qty = Number(document.getElementById("r_qty").value);
  if (qty > item.availableQuantity){
    toast(`Only ${item.availableQuantity} unit(s) available`, "error");
    return;
  }
  const payload = {
    id, quantity: qty,
    customerName: document.getElementById("r_name").value,
    customerPhone: document.getElementById("r_phone").value,
    days: Number(document.getElementById("r_days").value),
  };
  const res = await apiCall("rent", payload);
  if (!res.ok){ toast(res.error || "Rental failed", "error"); return; }
  await refreshEquipment();
  closeModal("rentOverlay");
  toast(`Rental confirmed for ${item.name}`);
}

/* ---------------- Admin: table ---------------- */
function renderAdminTable(){
  const body = document.getElementById("adminTableBody");
  const q = (document.getElementById("adminSearch")?.value || "").trim().toLowerCase();
  body.innerHTML = "";
  STATE.equipment
    .filter(e => !q || [e.name,e.brand,e.model,e.id].join(" ").toLowerCase().includes(q))
    .forEach(item=>{
      const isAvail = item.availableQuantity > 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img class="thumb" src="${item.imageURL || placeholderImage(item.category)}" onerror="this.src='${placeholderImage(item.category)}'"></td>
        <td>${item.id}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>₹${item.rentPerDay}</td>
        <td>${item.totalQuantity}</td>
        <td>${item.availableQuantity}</td>
        <td>${item.rentedQuantity}</td>
        <td class="${isAvail?'status-available':'status-rented'}">${isAvail?'Available':'Rented'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openEquipmentForm('${item.id}')">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="quickReturn('${item.id}')">Return Unit</button>
          <button class="btn btn-red btn-sm" onclick="handleDelete('${item.id}')">Delete</button>
        </td>
      `;
      body.appendChild(tr);
    });
}

async function quickReturn(id){
  const item = STATE.equipment.find(e=>e.id===id);
  if (!item || item.rentedQuantity<=0){ toast("No rented units to return", "error"); return; }
  const res = await apiCall("return", { id, quantity:1 });
  if (!res.ok){ toast(res.error || "Failed to update", "error"); return; }
  await refreshEquipment();
  toast(`1 unit of ${item.name} marked returned`);
}

async function handleDelete(id){
  const item = STATE.equipment.find(e=>e.id===id);
  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
  const res = await apiCall("delete", { id });
  if (!res.ok){ toast(res.error || "Delete failed", "error"); return; }
  await refreshEquipment();
  toast("Equipment deleted");
}

/* ---------------- Admin: add/edit form ---------------- */
/* ---------------- Admin: add/edit form ---------------- */
function openEquipmentForm(id){
  const form = document.getElementById("equipmentForm");
  form.reset();
  if (id){
    const item = STATE.equipment.find(e=>e.id===id);
    document.getElementById("formTitle").textContent = "Edit Equipment";
    document.getElementById("f_id").value = item.id;
    document.getElementById("f_name").value = item.name;
    document.getElementById("f_category").value = item.category;
    document.getElementById("f_brand").value = item.brand;
    document.getElementById("f_model").value = item.model;
    document.getElementById("f_condition").value = item.condition;
    document.getElementById("f_image").value = item.imageURL || "";
    document.getElementById("f_description").value = item.description || "";
    document.getElementById("f_features").value = (item.features||[]).join(", ");
    document.getElementById("f_specs").value = Object.entries(item.specifications||{}).map(([k,v])=>`${k}:${v}`).join(", ");
    document.getElementById("f_rent").value = item.rentPerDay;
    document.getElementById("f_deposit").value = item.securityDeposit;
    document.getElementById("f_total").value = item.totalQuantity;
    document.getElementById("f_avail").value = item.availableQuantity;
  } else {
    document.getElementById("formTitle").textContent = "Add Equipment";
    document.getElementById("f_id").value = "";
  }
  openModal("formOverlay");
}

function syncAvailMax(){
  const total = Number(document.getElementById("f_total").value)||0;
  const availEl = document.getElementById("f_avail");
  if (Number(availEl.value) > total) availEl.value = total;
  availEl.max = total;
}

async function handleFormSubmit(evt){
  evt.preventDefault();

  const id = document.getElementById("f_id").value;
  const total = Number(document.getElementById("f_total").value);
  const avail = Number(document.getElementById("f_avail").value);
  if (avail > total){ toast("Available quantity cannot exceed total quantity", "error"); return; }

  const payload = {
    name: document.getElementById("f_name").value,
    category: document.getElementById("f_category").value,
    brand: document.getElementById("f_brand").value,
    model: document.getElementById("f_model").value,
    condition: document.getElementById("f_condition").value,
    imageURL: document.getElementById("f_image").value,
    description: document.getElementById("f_description").value,
    features: document.getElementById("f_features").value.split(",").map(s=>s.trim()).filter(Boolean),
    specifications: Object.fromEntries(
      document.getElementById("f_specs").value.split(",").map(s=>s.trim()).filter(Boolean).map(pair=>{
        const [k,...rest] = pair.split(":"); return [(k||"").trim(), rest.join(":").trim()];
      })
    ),
    rentPerDay: Number(document.getElementById("f_rent").value),
    securityDeposit: Number(document.getElementById("f_deposit").value),
    totalQuantity: total,
    availableQuantity: avail,
  };

  const btn = document.getElementById("formSubmitBtn");
  btn.disabled = true; btn.textContent = "Saving...";
  try{
    const res = id ? await apiCall("update", { id, ...payload }) : await apiCall("create", payload);
    if (!res.ok){ toast(res.error || "Save failed", "error"); return; }
    await refreshEquipment();
    closeModal("formOverlay");
    toast(id ? "Equipment updated" : "Equipment added");
  } catch (err) {
    toast("Network error — please check your connection and try again", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Save Equipment";
  }
}

async function refreshEquipment(){
  const res = await apiCall("list");
  STATE.equipment = res.data || [];
  populateCategoryFilter();
  applyFilters();
  renderAdminTable();
}

/* ---------------- View / modal helpers ---------------- */
function switchView(view){
  const wantsAdmin = view === "admin";
  if (wantsAdmin && !STATE.isAdmin){
    const pw = prompt("Enter admin password (demo):");
    if (pw !== CONFIG.ADMIN_PASSWORD){
      if (pw !== null) toast("Incorrect password", "error");
      return;
    }
    STATE.isAdmin = true;
  }
  document.getElementById("viewCatalog").classList.toggle("active", !wantsAdmin);
  document.getElementById("viewAdmin").classList.toggle("active", wantsAdmin);
  document.getElementById("tabCatalog").classList.toggle("active", !wantsAdmin);
  document.getElementById("tabAdmin").classList.toggle("active", wantsAdmin);
}
function openModal(id){ document.getElementById(id).classList.add("open"); }
function closeModal(id){ document.getElementById(id).classList.remove("open"); }
document.addEventListener("click", (e)=>{
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
});
document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape") document.querySelectorAll(".modal-overlay.open").forEach(m=>m.classList.remove("open"));
});

boot();

  const id = document.getElementById("f_id").value;
  const total = Number(document.getElementById("f_total").value);
  const avail = Number(document.getElementById("f_avail").value);
  if (avail > total){ toast("Available quantity cannot exceed total quantity", "error"); return; }

  const payload = {
    name: document.getElementById("f_name").value,
    category: document.getElementById("f_category").value,
    brand: document.getElementById("f_brand").value,
    model: document.getElementById("f_model").value,
    condition: document.getElementById("f_condition").value,
    imageURL: document.getElementById("f_image").value,
    description: document.getElementById("f_description").value,
    features: document.getElementById("f_features").value.split(",").map(s=>s.trim()).filter(Boolean),
    specifications: Object.fromEntries(
      document.getElementById("f_specs").value.split(",").map(s=>s.trim()).filter(Boolean).map(pair=>{
        const [k,...rest] = pair.split(":"); return [(k||"").trim(), rest.join(":").trim()];
      })
    ),
    rentPerDay: Number(document.getElementById("f_rent").value),
    securityDeposit: Number(document.getElementById("f_deposit").value),
    totalQuantity: total,
    availableQuantity: avail,
  };

  const btn = document.getElementById("formSubmitBtn");
  btn.disabled = true; btn.textContent = "Saving...";
  try{
    const res = id ? await apiCall("update", { id, ...payload }) : await apiCall("create", payload);
    if (!res.ok){ toast(res.error || "Save failed", "error"); return; }
    await refreshEquipment();
    closeModal("formOverlay");
    toast(id ? "Equipment updated" : "Equipment added");
  } finally {
    btn.disabled = false; btn.textContent = "Save Equipment";
  }
}

async function refreshEquipment(){
  const res = await apiCall("list");
  STATE.equipment = res.data || [];
  populateCategoryFilter();
  applyFilters();
  renderAdminTable();
}

/* ---------------- View / modal helpers ---------------- */
function switchView(view){
  const wantsAdmin = view === "admin";
  if (wantsAdmin && !STATE.isAdmin){
    const pw = prompt("Enter admin password (demo):");
    if (pw !== CONFIG.ADMIN_PASSWORD){
      if (pw !== null) toast("Incorrect password", "error");
      return;
    }
    STATE.isAdmin = true;
  }
  document.getElementById("viewCatalog").classList.toggle("active", !wantsAdmin);
  document.getElementById("viewAdmin").classList.toggle("active", wantsAdmin);
  document.getElementById("tabCatalog").classList.toggle("active", !wantsAdmin);
  document.getElementById("tabAdmin").classList.toggle("active", wantsAdmin);
}
function openModal(id){ document.getElementById(id).classList.add("open"); }
function closeModal(id){ document.getElementById(id).classList.remove("open"); }
document.addEventListener("click", (e)=>{
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
});
document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape") document.querySelectorAll(".modal-overlay.open").forEach(m=>m.classList.remove("open"));
});



async function handleFormSubmit(evt){
  evt.preventDefault();
  ...
  const btn = document.getElementById("formSubmitBtn");
  btn.disabled = true; btn.textContent = "Saving...";
  try{
    const res = id ? await apiCall("update", { id, ...payload }) : await apiCall("create", payload);
    if (!res.ok){ toast(res.error || "Save failed", "error"); return; }
    await refreshEquipment();
    closeModal("formOverlay");
    toast(id ? "Equipment updated" : "Equipment added");
  } catch (err) {
    toast("Network error — please check your connection and try again", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Save Equipment";
  }
}



boot();
