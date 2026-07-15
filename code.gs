/**
 * =========================================================================
 * FieldStock — Farm Equipment Rental Management System
 * Google Apps Script backend.
 *
 * Data store : a Google Sheet named SHEET_NAME (created automatically).
 * Photos     : store the image on Google Drive, share it "Anyone with the
 *              link", then paste a direct URL of the form
 *              https://drive.google.com/uc?id=FILE_ID  into the
 *              "Image URL" field in the Admin form (imageURL column here).
 *
 * Deploy as: Extensions > Apps Script > paste this file as Code.gs >
 *            Deploy > New deployment > Web app
 *              Execute as:   Me
 *              Who has access: Anyone
 *            Copy the resulting /exec URL into CONFIG.API_URL in index.html
 *            and set CONFIG.DEMO_MODE = false.
 * =========================================================================
 */

const SPREADSHEET_ID = "1R-b-vEEV2XuFf9hcc17OlFhXS1Ayo-gHMikwQTOMO-A";
const SHEET_NAME = "Equipment";              

// Column order — keep in sync with COLUMNS below and with the objects
// produced by rowToObject() / objectToRow().
const COLUMNS = [
  "id", "name", "category", "brand", "model", "condition",
  "rentPerDay", "securityDeposit",
  "totalQuantity", "availableQuantity", "rentedQuantity",
  "description", "features", "specifications",
  "imageURL", "status", "createdAt"
];

/* ---------------------------------------------------------------------
 * Sheet helpers
 * ------------------------------------------------------------------- */
function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  // Make sure headers exist even if sheet was created empty by hand.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowToObject_(row) {
  const obj = {};
  COLUMNS.forEach((col, i) => {
    let val = row[i];
    if (col === "features") {
      obj[col] = safeParseArray_(val);
    } else if (col === "specifications") {
      obj[col] = safeParseObject_(val);
    } else if (["rentPerDay", "securityDeposit", "totalQuantity", "availableQuantity", "rentedQuantity"].includes(col)) {
      obj[col] = Number(val) || 0;
    } else {
      obj[col] = val === undefined || val === null ? "" : val;
    }
  });
  return obj;
}

function objectToRow_(obj) {
  return COLUMNS.map(col => {
    if (col === "features") {
      return JSON.stringify(Array.isArray(obj.features) ? obj.features : []);
    }
    if (col === "specifications") {
      return JSON.stringify(obj.specifications && typeof obj.specifications === "object" ? obj.specifications : {});
    }
    return obj[col] !== undefined ? obj[col] : "";
  });
}

function safeParseArray_(val) {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}
function safeParseObject_(val) {
  try {
    const parsed = JSON.parse(val);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function findRowIndexById_(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === String(id)) return r + 1; // 1-indexed sheet row
  }
  return -1;
}

function getAllEquipment_() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1).filter(r => r[0]); // skip header, skip blank rows
  return rows.map(rowToObject_);
}

function recalcStatus_(obj) {
  obj.totalQuantity = Number(obj.totalQuantity) || 0;
  obj.availableQuantity = Math.max(0, Math.min(obj.totalQuantity, Number(obj.availableQuantity) || 0));
  obj.rentedQuantity = obj.totalQuantity - obj.availableQuantity;
  obj.status = obj.availableQuantity > 0 ? "Available" : "Rented";
  return obj;
}

function generateId_() {
  return "EQ" + String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 90 + 10));
}

/* ---------------------------------------------------------------------
 * HTTP entry points
 * ------------------------------------------------------------------- */
function doGet(e) {
  const action = (e.parameter.action || "list").toLowerCase();
  try {
    if (action === "list") {
      return jsonOut_({ ok: true, data: getAllEquipment_() });
    }
    if (action === "get") {
      const id = e.parameter.id;
      const item = getAllEquipment_().find(x => x.id === id) || null;
      return jsonOut_({ ok: true, data: item });
    }
    return jsonOut_({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: "Invalid JSON body" });
  }
  const action = (body.action || "").toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (action) {
      case "create":  return jsonOut_(handleCreate_(body));
      case "update":  return jsonOut_(handleUpdate_(body));
      case "delete":  return jsonOut_(handleDelete_(body));
      case "rent":    return jsonOut_(handleRent_(body));
      case "return":  return jsonOut_(handleReturn_(body));
      default:        return jsonOut_({ ok: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------------
 * Action handlers — mirror demoHandler() in app.js exactly
 * ------------------------------------------------------------------- */
function handleCreate_(payload) {
  const sheet = getSheet_();
  const item = recalcStatus_(Object.assign({
    id: generateId_(),
    createdAt: new Date().toISOString(),
    name: "", category: "", brand: "", model: "", condition: "Good",
    rentPerDay: 0, securityDeposit: 0,
    totalQuantity: 0, availableQuantity: 0,
    description: "", features: [], specifications: {}, imageURL: ""
  }, payload));
  sheet.appendRow(objectToRow_(item));
  return { ok: true, data: item };
}

function handleUpdate_(payload) {
  const sheet = getSheet_();
  const rowIdx = findRowIndexById_(sheet, payload.id);
  if (rowIdx === -1) return { ok: false, error: "Equipment not found" };

  const existing = rowToObject_(sheet.getRange(rowIdx, 1, 1, COLUMNS.length).getValues()[0]);
  const merged = recalcStatus_(Object.assign({}, existing, payload));
  sheet.getRange(rowIdx, 1, 1, COLUMNS.length).setValues([objectToRow_(merged)]);
  return { ok: true, data: merged };
}

function handleDelete_(payload) {
  const sheet = getSheet_();
  const rowIdx = findRowIndexById_(sheet, payload.id);
  if (rowIdx === -1) return { ok: false, error: "Equipment not found" };
  sheet.deleteRow(rowIdx);
  return { ok: true };
}

function handleRent_(payload) {
  const sheet = getSheet_();
  const rowIdx = findRowIndexById_(sheet, payload.id);
  if (rowIdx === -1) return { ok: false, error: "Equipment not found" };

  const range = sheet.getRange(rowIdx, 1, 1, COLUMNS.length);
  const item = rowToObject_(range.getValues()[0]);
  const qty = Number(payload.quantity) || 0;

  if (qty <= 0) return { ok: false, error: "Quantity must be greater than zero" };
  if (qty > item.availableQuantity) return { ok: false, error: "Not enough units available" };

  item.availableQuantity -= qty;
  recalcStatus_(item);
  range.setValues([objectToRow_(item)]);

  logTransaction_("RENT", item.id, item.name, qty, payload.customerName, payload.customerPhone, payload.days);
  return { ok: true, data: item };
}

function handleReturn_(payload) {
  const sheet = getSheet_();
  const rowIdx = findRowIndexById_(sheet, payload.id);
  if (rowIdx === -1) return { ok: false, error: "Equipment not found" };

  const range = sheet.getRange(rowIdx, 1, 1, COLUMNS.length);
  const item = rowToObject_(range.getValues()[0]);
  const qty = Number(payload.quantity) || 0;

  item.availableQuantity = Math.min(item.totalQuantity, item.availableQuantity + qty);
  recalcStatus_(item);
  range.setValues([objectToRow_(item)]);

  logTransaction_("RETURN", item.id, item.name, qty, "", "", "");
  return { ok: true, data: item };
}

/* ---------------------------------------------------------------------
 * Optional transaction log (separate sheet tab) — useful for an audit
 * trail of who rented what and when. Safe to ignore/remove.
 * ------------------------------------------------------------------- */
function logTransaction_(type, equipId, equipName, qty, customerName, customerPhone, days) {
 const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let log = ss.getSheetByName("Transactions");
  if (!log) {
    log = ss.insertSheet("Transactions");
    log.appendRow(["Timestamp", "Type", "EquipmentID", "EquipmentName", "Quantity", "CustomerName", "CustomerPhone", "Days"]);
    log.setFrozenRows(1);
  }
  log.appendRow([new Date(), type, equipId, equipName, qty, customerName || "", customerPhone || "", days || ""]);
}

/* ---------------------------------------------------------------------
 * One-time setup: run this manually from the Apps Script editor
 * (select seedInitialData in the function dropdown, click Run) to
 * populate the sheet with the same 22 demo equipment rows used by the
 * front-end DEMO_MODE, so the live backend starts with real data.
 * ------------------------------------------------------------------- */
function seedInitialData() {
  const sheet = getSheet_();
  // Don't reseed if data already exists.
  if (sheet.getLastRow() > 1) {
    Logger.log("Sheet already has data — skipping seed. Clear rows 2+ first if you want to reseed.");
    return;
  }

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
      "Tank:12 L,Battery:12V/8Ah,Weight:5.5 kg"]
  ];

  rows.forEach((r, i) => {
    const [name, category, brand, model, condition, rent, deposit, total, available, description, features, specs] = r;
    const specObj = {};
    specs.split(",").forEach(pair => {
      const [k, v] = pair.split(":");
      specObj[k.trim()] = (v || "").trim();
    });
    const item = recalcStatus_({
      id: "EQ" + String(i + 1).padStart(3, "0"),
      name, category, brand, model, condition,
      rentPerDay: rent, securityDeposit: deposit,
      totalQuantity: total, availableQuantity: available,
      description,
      features: features.split(",").map(s => s.trim()),
      specifications: specObj,
      imageURL: "",
      createdAt: new Date().toISOString()
    });
    sheet.appendRow(objectToRow_(item));
  });

  Logger.log("Seeded " + rows.length + " equipment rows.");
}
