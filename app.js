/* =========================================================================
   FieldStock — Farm Equipment Rental Management System
   Frontend logic. Works standalone in DEMO_MODE (localStorage) and switches
   seamlessly to a live Google Apps Script backend when CONFIG.DEMO_MODE=false.
   ========================================================================= */

let STATE = {
  equipment: [],
  isAdmin: false,
};

/* ---------------- Category icon / placeholder image ---------------- */
const CATEGORY_META = {
  "Tractors":            { emoji:"🚜", color:"#E2622B" },
  "Harvesters":           { emoji:"🌾", color:"#C98A1F" },
  "Tillage Equipment":    { emoji:"⚙️", color:"#4C6B3D" },
  "Planting Equipment":   { emoji:"🌱", color:"#3F7D45" },
  "Irrigation":           { emoji:"💧", color:"#2E6E8E" },
  "Sprayers":             { emoji:"💦", color:"#3A7CA5" },
  "Trailers & Transport":{ emoji:"🚛", color:"#6B4C3D" },
  "Post-Harvest":         { emoji:"🌽", color:"#B2841F" },
  "Power Tools":          { emoji:"🔧", color:"#7A4C6B" },
};
function placeholderImage(category){
  const meta = CATEGORY_META[category] || { emoji:"🔩", color:"#54604A" };
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${meta.color}"/>
    <rect width="400" height="300" fill="url(#g)"/>
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.12"/>
      </linearGradient>
    </defs>
    <text x="200" y="175" font-size="96" text-anchor="middle" dominant-baseline="middle">${meta.emoji}</text>
    <text x="200" y="255" font-size="14" fill="#ffffffcc" text-anchor="middle" font-family="monospace" letter-spacing="2">${category.toUpperCase()}</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/* ---------------- Seed / demo data ---------------- */
function seedData(){
  const rows = [
    ["Compact Utility Tractor 25HP","Tractors","AgroMax","AM-25U","Excellent",1250,15000,4,2,
      "Nimble tractor ideal for small plots, orchards and light haulage.",
      "4WD,Power steering,LED work lights,PTO shaft",
      "Engine:25 HP,Fuel Tank:35 L,Transmission:8F+2R,Weight:1150 kg"],
    ["Heavy Duty Farm Tractor 75HP","Tractors","TerraTech","TT-75H","Good",2600,40000,3,1,
      "High-torque tractor built for deep ploughing and heavy implement towing.",
      "4WD,Dual clutch,Hydraulic lift,Canopy",
      "Engine:75 HP,Fuel Tank:65 L,Transmission:12F+4R,Weight:2600 kg"],
    ["4WD All-Terrain Tractor 90HP","Tractors","FarmPro","FP-90X","Excellent",3200,50000,2,2,
      "All-terrain tractor for large-scale farms and hilly fields.",
      "4WD,Turbocharged engine,AC cabin,GPS ready",
      "Engine:90 HP,Fuel Tank:80 L,Transmission:16F+8R,Weight:3100 kg"],
    ["Self-Propelled Combine Harvester","Harvesters","GreenField","GF-CH400","Good",5200,120000,2,0,
      "Efficient combine for wheat, paddy and soybean harvesting.",
      "Adjustable header,Grain tank sensor,Straw chopper",
      "Header Width:4.2 m,Grain Tank:2200 L,Engine:130 HP"],
    ["Mini Rice Harvester","Harvesters","PowerAgri","PA-RH2","Excellent",1800,25000,3,1,
      "Compact harvester suited for small and terraced rice fields.",
      "Lightweight chassis,Low fuel consumption,Easy maneuvering",
      "Header Width:1.2 m,Engine:24 HP,Weight:850 kg"],
    ["Sugarcane Harvester","Harvesters","TerraTech","TT-SC1","Fair",6000,150000,1,0,
      "Heavy-duty machine for large sugarcane plantations.",
      "Base cutter,Topper unit,High capacity elevator",
      "Engine:250 HP,Cutting Width:1.5 m,Weight:14000 kg"],
    ["Hydraulic Disc Plough","Tillage Equipment","AgroMax","AM-DP3","Good",700,8000,6,3,
      "3-disc plough for primary tillage on medium to heavy soils.",
      "Hydraulic depth control,Hardened steel discs",
      "Discs:3,Working Width:0.9 m,Weight:320 kg"],
    ["Rotavator (Rotary Tiller)","Tillage Equipment","FarmPro","FP-RT6","Excellent",900,10000,5,2,
      "Prepares seedbeds quickly by breaking and mixing soil in one pass.",
      "Side drive gearbox,Adjustable tilling depth,Slip clutch",
      "Working Width:1.8 m,Blades:36,Weight:420 kg"],
    ["Spring Loaded Cultivator","Tillage Equipment","GreenField","GF-CL9","Good",550,6000,7,4,
      "Loosens soil and removes weeds ahead of planting.",
      "Spring-loaded tynes,Adjustable row spacing",
      "Tynes:9,Working Width:2.1 m,Weight:280 kg"],
    ["Multi-Crop Seed Drill","Planting Equipment","AgroMax","AM-SD11","Excellent",850,9000,4,1,
      "Precision seed drill for uniform seed and fertilizer placement.",
      "Adjustable seed rate,Fertilizer box,Furrow openers",
      "Rows:11,Working Width:2.5 m,Hopper:120 L"],
    ["Rice Transplanter","Planting Equipment","PowerAgri","PA-RT4","Good",1400,18000,3,0,
      "Walk-behind transplanter for fast, uniform rice seedling planting.",
      "4-row planting,Float-assisted balance,Low fuel use",
      "Rows:4,Row Spacing:30 cm,Weight:210 kg"],
    ["Automatic Potato Planter","Planting Equipment","TerraTech","TT-PP2","Fair",1100,14000,2,1,
      "Two-row planter for accurate potato seed spacing and depth.",
      "Adjustable spacing,Fertilizer attachment",
      "Rows:2,Hopper Capacity:250 kg,Weight:480 kg"],
    ["Sprinkler Irrigation Set","Irrigation","GreenField","GF-SI1","Excellent",450,5000,8,5,
      "Portable sprinkler set for even water distribution across fields.",
      "Rotating heads,Portable pipes,Pressure regulator",
      "Coverage:0.4 ha/set,Pipe Length:100 m,Heads:6"],
    ["Drip Irrigation Kit","Irrigation","AgroMax","AM-DI1","Good",380,4500,6,3,
      "Water-efficient drip system ideal for row crops and orchards.",
      "Pressure-compensated emitters,Filter unit included",
      "Coverage:0.5 ha/kit,Emitter Spacing:30 cm"],
    ["Diesel Water Pump 5HP","Irrigation","FarmPro","FP-WP5","Excellent",300,4000,10,6,
      "Reliable pump for lifting irrigation water from wells and canals.",
      "Self-priming,Low vibration,Portable frame",
      "Power:5 HP,Discharge:900 L/min,Suction Head:7 m"],
    ["Tractor-Mounted Boom Sprayer","Sprayers","TerraTech","TT-BS500","Good",750,8500,4,1,
      "Wide-coverage boom sprayer for pesticide and fertilizer application.",
      "Adjustable boom width,Pressure gauge,Foldable arms",
      "Tank:500 L,Boom Width:9 m,Nozzles:18"],
    ["Knapsack Power Sprayer","Sprayers","PowerAgri","PA-KS16","Excellent",180,2000,12,8,
      "Backpack sprayer with engine-driven pump for small to mid plots.",
      "Adjustable nozzle,Padded straps,Easy-start engine",
      "Tank:16 L,Engine:2-stroke,Weight:9 kg"],
    ["Farm Trailer 2-Ton","Trailers & Transport","AgroMax","AM-FT2","Good",500,7000,5,2,
      "Sturdy trailer for transporting harvest, feed and equipment.",
      "Tipping mechanism,Mudguards,Heavy-duty axle",
      "Capacity:2000 kg,Bed Size:2.4x1.5 m"],
    ["Hydraulic Tipping Trailer 4-Ton","Trailers & Transport","GreenField","GF-HT4","Excellent",850,12000,3,1,
      "Hydraulic tipping trailer for fast, effortless unloading.",
      "Hydraulic ram,Reinforced chassis,Safety props",
      "Capacity:4000 kg,Bed Size:3.0x1.8 m"],
    ["Motorized Chaff Cutter","Post-Harvest","FarmPro","FP-CC1","Good",320,3500,6,3,
      "Cuts fodder efficiently for livestock feed preparation.",
      "Safety guard,Adjustable cut length,Electric motor",
      "Power:5 HP,Output:1200 kg/hr"],
    ["Multi-Crop Thresher Machine","Post-Harvest","TerraTech","TT-TH8","Excellent",950,11000,4,2,
      "Threshes wheat, paddy and pulses with minimal grain loss.",
      "Interchangeable sieves,Blower unit,Mobile chassis",
      "Power:10 HP,Output:800 kg/hr,Weight:650 kg"],
    ["Petrol Power Weeder","Power Tools","PowerAgri","PA-PW3","Excellent",280,3000,8,5,
      "Lightweight power weeder for inter-row weeding and soil aeration.",
      "Adjustable tilling width,Foldable handle,Easy-start",
      "Power:3.5 HP,Working Width:60 cm,Weight:38 kg"],
    ["Battery Backpack Sprayer","Power Tools","GreenField","GF-BS12","Good",150,1800,10,7,
      "Rechargeable battery sprayer for quiet, fume-free operation.",
      "Rechargeable battery,Adjustable pressure,Lightweight",
      "Tank:12 L,Battery:12V/8Ah,Weight:5.5 kg"],
  ];
  return rows.map((r,i)=>{
    const [name,category,brand,model,condition,rent,deposit,total,available,description,features,specs] = r;
    return {
      id: "EQ" + String(i+1).padStart(3,"0"),
      name, category, brand, model, condition,
      rentPerDay: rent, securityDeposit: deposit,
      totalQuantity: total, availableQuantity: available,
      rentedQuantity: total - available,
      description,
      features: features.split(",").map(s=>s.trim()),
      specifications: Object.fromEntries(specs.split(",").map(s=>{
        const [k,v] = s.split(":"); return [k.trim(), (v||"").trim()];
      })),
      imageURL: "",
      status: available > 0 ? "Available" : "Rented",
      createdAt: new Date().toISOString(),
    };
  });
}

function loadDemoData(){
  const raw = localStorage.getItem("fieldstock_demo_data");
  if (raw){ return JSON.parse(raw); }
  const seeded = seedData();
  localStorage.setItem("fieldstock_demo_data", JSON.stringify(seeded));
  return seeded;
}
function saveDemoData(list){
  localStorage.setItem("fieldstock_demo_data", JSON.stringify(list));
}

/* =========================================================================
   API LAYER — every call here mirrors the Google Apps Script endpoints
   defined in Code.gs. Swap DEMO_MODE off once a live deployment exists.
   ========================================================================= */
async function apiCall(action, payload){
  if (CONFIG.DEMO_MODE){
    return demoHandler(action, payload);
  }
  if (!CONFIG.API_URL){
    throw new Error("CONFIG.API_URL is not set. Deploy Code.gs as a Web App and paste the URL in index.html.");
  }
  if (action === "list" || action === "get"){
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set("action", action);
    if (payload && payload.id) url.searchParams.set("id", payload.id);
    const res = await fetch(url.toString(), { method:"GET" });
    return res.json();
  }
  // POST — use text/plain to avoid CORS preflight against Apps Script
  const res = await fetch(CONFIG.API_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

function recalcStatus(item){
  item.rentedQuantity = item.totalQuantity - item.availableQuantity;
  item.status = item.availableQuantity > 0 ? "Available" : "Rented";
  return item;
}

function demoHandler(action, payload){
  let list = loadDemoData();
  switch(action){
    case "list":
      return { ok:true, data:list };
    case "get":
      return { ok:true, data:list.find(e=>e.id===payload.id) || null };
    case "create": {
      const id = "EQ" + String(Date.now()).slice(-6);
      const item = recalcStatus({ id, createdAt:new Date().toISOString(), ...payload });
      list.push(item);
      saveDemoData(list);
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
      if (payload.quantity > item.availableQuantity){
        return { ok:false, error:"Not enough units available" };
      }
      item.availableQuantity -= payload.quantity;
      recalcStatus(item);
      saveDemoData(list);
      return { ok:true, data:item };
    }
    case "return": {
      const idx = list.findIndex(e=>e.id===payload.id);
      if (idx === -1) return { ok:false, error:"Equipment not found" };
      const item = list[idx];
      item.availableQuantity = Math.min(item.totalQuantity, item.availableQuantity + payload.quantity);
      recalcStatus(item);
      saveDemoData(list);
      return { ok:true, data:item };
    }
    default:
      return { ok:false, error:"Unknown action" };
  }
}

/* ---------------- Toasts ---------------- */
function toast(msg, type="ok"){
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast" + (type==="error" ? " error" : "");
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(()=>el.remove(), 3200);
}

/* ---------------- Boot ---------------- */
async function boot(){
  document.getElementById("modeDot").classList.toggle("live", !CONFIG.DEMO_MODE);
  document.getElementById("modeText").textContent = CONFIG.DEMO_MODE ? "Demo Mode (local data)" : "Connected — Live Backend";

  const res = await apiCall("list");
  STATE.equipment = res.data || [];
  populateCategoryFilter();
  applyFilters();
  renderAdminTable();

  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("availFilter").addEventListener("change", applyFilters);
}

function populateCategoryFilter(){
  const sel = document.getElementById("categoryFilter");
  const cats = [...new Set(STATE.equipment.map(e=>e.category))].sort();
  cats.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

/* ---------------- Filtering & rendering ---------------- */
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

  renderStats(STATE.equipment);
  renderGrid(list);
  document.getElementById("resultCount").textContent = `${list.length} of ${STATE.equipment.length} shown`;
}

function renderStats(list){
  document.getElementById("statTypes").textContent = list.length;
  document.getElementById("statTotal").textContent = list.reduce((a,e)=>a+Number(e.totalQuantity||0),0);
  document.getElementById("statAvail").textContent = list.reduce((a,e)=>a+Number(e.availableQuantity||0),0);
  document.getElementById("statRented").textContent = list.reduce((a,e)=>a+Number(e.rentedQuantity||0),0);
}

function renderGrid(list){
  const grid = document.getElementById("equipmentGrid");
  grid.innerHTML = "";
  if (list.length === 0){
    grid.innerHTML = `<div class="empty-state"><h3>No equipment matches your filters</h3><p>Try clearing the search or filters above.</p></div>`;
    return;
  }
  list.forEach(item=>{
    const isAvail = item.availableQuantity > 0;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <span class="rivet tl"></span><span class="rivet tr"></span>
      <div class="card-photo">
        <img src="${item.imageURL || placeholderImage(item.category)}" alt="${escapeHtml(item.name)}" loading="lazy"
             onerror="this.src='${placeholderImage(item.category)}'">
        <span class="status-stamp ${isAvail ? 'available':'rented'}">${isAvail ? 'Available' : 'Rented Out'}</span>
      </div>
      <div class="card-body">
        <span class="card-cat">${item.category}</span>
        <h3 class="card-name">${escapeHtml(item.name)}</h3>
        <span class="card-meta">${escapeHtml(item.brand)} · ${escapeHtml(item.model)}</span>
        <div class="card-footer">
          <div class="price">₹${Number(item.rentPerDay).toLocaleString()} <span>/ day</span></div>
          <button class="btn btn-outline btn-sm" onclick="openDetail('${item.id}')">View Details</button>
        </div>
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
  const specsHtml = Object.entries(item.specifications||{}).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("");

  document.getElementById("detailContent").innerHTML = `
    <div class="detail-photo">
      <img src="${item.imageURL || placeholderImage(item.category)}" alt="${escapeHtml(item.name)}"
           onerror="this.src='${placeholderImage(item.category)}'">
    </div>
    <div class="detail-info">
      <div class="detail-id">EQUIPMENT ID · ${item.id}</div>
      <h2>${escapeHtml(item.name)}</h2>
      <div class="detail-tags">
        <span class="tag">${item.category}</span>
        <span class="tag">${escapeHtml(item.brand)}</span>
        <span class="tag">${escapeHtml(item.model)}</span>
        <span class="tag">Condition: ${item.condition}</span>
      </div>
      <p class="detail-desc">${escapeHtml(item.description || "No description provided.")}</p>

      <div class="price-box">
        <div><div class="num">₹${Number(item.rentPerDay).toLocaleString()}</div><div class="lbl">Rent / Day</div></div>
        <div><div class="num">₹${Number(item.securityDeposit).toLocaleString()}</div><div class="lbl">Security Deposit</div></div>
      </div>

      <div class="avail-box">
        <div class="item"><b>${item.totalQuantity}</b>Total Qty</div>
        <div class="item"><b>${item.availableQuantity}</b>Available Qty</div>
        <div class="item"><b>${item.rentedQuantity}</b>Rented Qty</div>
        <div class="item"><span class="badge ${isAvail?'available':'rented'}">${isAvail ? 'Available' : 'Rented Out'}</span></div>
      </div>

      ${featuresHtml ? `<div class="detail-section-title">Features</div><ul class="feature-list">${featuresHtml}</ul>` : ""}
      ${specsHtml ? `<div class="detail-section-title">Specifications</div><table class="spec-table">${specsHtml}</table>` : ""}

      <div class="detail-actions">
        <button class="btn btn-primary" ${isAvail ? "" : "disabled"} onclick="openRent('${item.id}')">Rent Now</button>
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
  ["r_qty","r_days"].forEach(id=>document.getElementById(id).oninput = updateRentTotal);
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
  body.innerHTML = "";
  STATE.equipment.forEach(item=>{
    const isAvail = item.availableQuantity > 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${item.imageURL || placeholderImage(item.category)}" onerror="this.src='${placeholderImage(item.category)}'"></td>
      <td style="font-family:var(--font-mono);font-size:11.5px;">${item.id}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.category}</td>
      <td>₹${item.rentPerDay}</td>
      <td>${item.totalQuantity}</td>
      <td>${item.availableQuantity}</td>
      <td>${item.rentedQuantity}</td>
      <td><span class="badge ${isAvail?'available':'rented'}">${isAvail?'Available':'Rented'}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-outline btn-sm" onclick="openEquipmentForm('${item.id}')">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="quickReturn('${item.id}')">Return Unit</button>
          <button class="btn btn-danger btn-sm" onclick="handleDelete('${item.id}')">Delete</button>
        </div>
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
  btn.disabled = true; btn.textContent = "Saving…";
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
