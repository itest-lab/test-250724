function createTrackingRow(context="add"){
  const row = document.createElement("div");
  row.className = "tracking-row";
  // display is controlled by CSS grid
  // row.style.display = row.style.display || "flex";
  row.style.alignItems = row.style.alignItems || "center";
  row.style.gap = row.style.gap || ".5em";

  // 運送会社<select>は常に表示。固定ONなら未選択行に初期値を適用
  const sel = document.createElement("select");
  sel.tabIndex = -1; // キーボード移動で選択肢に飛ばない
  sel.innerHTML = `
    <option value="">運送会社選択してください</option>
    <option value="yamato">ヤマト運輸</option>
    <option value="fukuyama">福山通運</option>
    <option value="seino">西濃運輸</option>
    <option value="tonami">トナミ運輸</option>
    <option value="hida">飛騨運輸</option>
    <option value="sagawa">佐川急便</option>`;
  const fixedValInit = (context === "add")
    ? (fixedCarrierCheckbox && fixedCarrierCheckbox.checked ? (fixedCarrierSelect?.value || "") : "")
    : (fixedCarrierCheckboxDetail && fixedCarrierCheckboxDetail.checked ? (fixedCarrierSelectDetail?.value || "") : "");
  if (fixedValInit) sel.value = fixedValInit;
  row.appendChild(sel);

  // 追跡番号<input>
  const inp = document.createElement("input");
  inp.classList.add("tracking-input");
  inp.type = "text";
  inp.placeholder = "追跡番号を入力してください";
  inp.inputMode = "numeric";
  const uniqueId = `tracking-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  inp.id = uniqueId;
  inp.addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, ""); });

  // Enter/Tab で次行へ。最終行なら新規行を自動追加
  inp.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === "Tab"){
      e.preventDefault();
      const inputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
      const countBefore = inputs.length;
      const idx = inputs.indexOf(inp);
      if (idx !== -1 && idx < countBefore - 1) {
        inputs[idx + 1].focus();
      } else {
        if (context === "detail") { detailAddRowBtn.click(); } else { addTrackingRowBtn.click(); }
        setTimeout(() => {
          const newInputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
          if (newInputs[countBefore]) newInputs[countBefore].focus();
          try{ renumberTrackingRows(context); }catch(_){}
        }, 0);
      }
    }
  });
  inp.addEventListener("beforeinput", e => {
  const t = e.inputType;
  if (t === "insertLineBreak" || t === "insertParagraph") {
    e.preventDefault();
    const inputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
    const countBefore = inputs.length;
    const idx = inputs.indexOf(inp);
    if (idx !== -1 && idx < countBefore - 1) {
      inputs[idx + 1].focus();
    } else {
      if (context === "detail") { detailAddRowBtn.click(); } else { addTrackingRowBtn.click(); }
      setTimeout(() => {
        const newInputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
        if (newInputs[countBefore]) newInputs[countBefore].focus();
        try{ renumberTrackingRows(context); }catch(_){ }
      }, 0);
    }
  }
});
row.appendChild(inp);

  
  (function ensureBadge(){
    if (!row.querySelector('.row-no')) {
      const badge = document.createElement('span');
      badge.className = 'row-no'; badge.style.cssText = 'display:inline-block;width:3ch;text-align:right;margin-right:.25em;font-weight:600;font-variant-numeric:tabular-nums;';
      row.insertBefore(badge, row.firstChild);
    }
  })();
// モバイルならカメラボタンを添付
  (function attachCaptureControls(){
    const canCamera = isMobileDevice() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (canCamera) {
      const camBtn = document.createElement('button');
      camBtn.type = 'button';
      camBtn.textContent = 'カメラ起動';
      camBtn.className = 'camera-btn';
      camBtn.addEventListener('click', () => {
        startScanning([Html5QrcodeSupportedFormats.CODABAR], uniqueId);
      });
      row.appendChild(camBtn);
    }
  })();

  // 行強調: 追跡入力済みなのにキャリア未選択なら強調（行選択 or 固定値）
  function updateMissingHighlight() {
    const tnVal = inp.value.trim();
    const rowVal = sel.value || "";
    const fixedVal = (context === "add")
      ? (fixedCarrierCheckbox && fixedCarrierCheckbox.checked ? (fixedCarrierSelect?.value || "") : "")
      : (fixedCarrierCheckboxDetail && fixedCarrierCheckboxDetail.checked ? (fixedCarrierSelectDetail?.value || "") : "");
    const carrierVal = rowVal || fixedVal || "";
    if (tnVal && !carrierVal) row.classList.add('missing-carrier'); else row.classList.remove('missing-carrier');
  }
  inp.addEventListener('input', updateMissingHighlight);
  sel.addEventListener('change', updateMissingHighlight);

  
  // ▼ 幅自動調整: 画面幅に追従（ADD/DETAIL 共通）
  row.style.flexWrap = 'nowrap'; row.style.width = '100%'; inp.style.flex = '1 1 auto';
  function fitRow(){
// CSSグリッドに委譲。明示幅は解除して100%フィット
    try{
      sel.style.removeProperty('width');
      sel.style.removeProperty('max-width');
      sel.style.removeProperty('min-width');
      inp.style.removeProperty('width');
      inp.style.removeProperty('max-width');
      inp.style.removeProperty('min-width');
      row.style.removeProperty('width');
      row.style.removeProperty('flexWrap');
    }catch(_){}
}
      let selectW = Math.max(minSelect, Math.min(remain - minInput, Math.floor(remain * 0.5)));
      if (selectW < minSelect) selectW = minSelect;
      const inputW = Math.max(minInput, remain - selectW);
      /* width via CSS */ /* width via CSS */
      /* width via CSS */ /* width via CSS */
    }catch(_){ }
  }
  setTimeout(fitRow, 0);
  window.addEventListener('resize', fitRow);
  sel.addEventListener('change', fitRow);
  return row;
}

/* ------------------------------
 * 詳細画面：固定キャリア切替（行<select>は消さない）
 *  - 固定ON/変更時に全行へ固定値を適用（手動選択済みも上書き）
 * ------------------------------ */
function applyFixedToUnselectedRows(context = "detail"){
  const rows = Array.from((context === "detail" ? detailTrackingRows : trackingRows).children);
  const fixedOn = (context === "detail") ? (fixedCarrierCheckboxDetail?.checked) : (fixedCarrierCheckbox?.checked);
  const fixedVal = (context === "detail") ? (fixedCarrierSelectDetail?.value || "") : (fixedCarrierSelect?.value || "");
  if (!fixedOn || !fixedVal) return;
  rows.forEach(row => {
    const sel = row.querySelector("select");
    if (sel) sel.value = fixedVal;
  });
}
// 詳細側
if (fixedCarrierCheckboxDetail) {
  fixedCarrierCheckboxDetail.onchange = () => {
    fixedCarrierSelectDetail.style.display = fixedCarrierCheckboxDetail.checked ? "inline-block" : "none";
    applyFixedToUnselectedRows("detail");
  };
}
if (fixedCarrierSelectDetail) {
  fixedCarrierSelectDetail.onchange = () => {
    if (!fixedCarrierCheckboxDetail.checked) return;
    applyFixedToUnselectedRows("detail");
  };
}

// 追加画面側（同じロジック）
if (fixedCarrierCheckbox) {
  fixedCarrierCheckbox.onchange = () => {
    fixedCarrierSelect.style.display = fixedCarrierCheckbox.checked ? "block" : "none";
    try{ ensureFixedCarrierToolbar('add'); }catch(_){}
    applyFixedToUnselectedRows("add");
  };
}
if (fixedCarrierSelect) {
  fixedCarrierSelect.onchange = () => {
    if (!fixedCarrierCheckbox.checked) return;
    applyFixedToUnselectedRows("add");
  };
}

/* ------------------------------
 * 追加画面の初期化
 * ------------------------------ */
function initAddCaseView(){
  scanModeDiv.style.display     = "block";
  manualModeDiv.style.display   = "none";
  caseDetailsDiv.style.display  = "none";
  caseBarcodeInput.value        = "";
  manualOrderIdInput.value      = "";
  manualCustomerInput.value     = "";
  manualTitleInput.value        = "";
  manualPlateDateInput.value    = "";
  addCaseMsg.textContent        = "";
  if (fixedCarrierCheckbox) fixedCarrierCheckbox.checked  = false;
  if (fixedCarrierSelect) { fixedCarrierSelect.style.display = "none"; fixedCarrierSelect.value = ""; }
  trackingRows.innerHTML        = "";
  for(let i=0;i<10;i++) trackingRows.appendChild(createTrackingRow("add"));
  renumberTrackingRows('add');
  renumberTrackingRows('add');
  ensureFixedCarrierToolbar('add');
}

// 追跡行の追加（追加画面）
addTrackingRowBtn.onclick = () => {
  for(let i=0;i<10;i++) trackingRows.appendChild(createTrackingRow("add"));
  renumberTrackingRows('add');
  renumberTrackingRows('add');
  ensureFixedCarrierToolbar('add');
};

// IME無効（QR欄）
caseBarcodeInput.addEventListener("compositionstart", e => e.preventDefault());

/* ------------------------------
 * 日付の緩い正規化（YYYY-MM-DD）と下版日抽出
 * ------------------------------ */
function normalizeDateString(s) {
  if (!s) return "";
  const nums = (s.match(/\d{1,4}/g) || []).map(n => parseInt(n, 10));
  if (nums.length >= 3) {
    let y = nums[0]; let m = nums[1]; let d = nums[2];
    if (y < 100) y = 2000 + y;
    m = Math.max(1, Math.min(12, m|0));
    d = Math.max(1, Math.min(31, d|0));
    const dt = new Date(Date.UTC(y, m-1, d));
    const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
    const dd = String(dt.getUTCDate()).padStart(2,'0');
    return `${dt.getUTCFullYear()}-${mm}-${dd}`;
  }
  return "";
}
function extractPlateDateField(text) {
  let fields = Array.from(text.matchAll(/"([^"]*)"/g), m=>m[1]);
  if (fields.length === 0) fields = text.split(/[\,\t\r\n]+/).map(s => s.trim()).filter(Boolean);
  let val = "";
  if (fields.length === 4) val = fields[3];
  else if (fields.length >= 10) val = fields[9];
  return normalizeDateString(val);
}

/* ------------------------------
 * 案件バーコード確定処理（ZLIB64対応）
 * ------------------------------ */
function processCaseBarcode(raw){
  if(!raw) return;
  let text;
  try{
    if(raw.startsWith("ZLIB64:")){
      const b64 = raw.slice(7);
      const bin = atob(b64);
      const arr = new Uint8Array([...bin].map(c=>c.charCodeAt(0)));
      const dec = pako.inflate(arr);
      text = new TextDecoder().decode(dec);
    } else {
      text = raw;
    }
  }catch(err){
    alert("QRデコード失敗: "+err.message);
    return;
  }
  text = text.trim().replace(/「[^」]*」/g, "");
  const matches = Array.from(text.matchAll(/"([^"]*)"/g), m=>m[1]);
  detailOrderId.textContent  = matches[0] || "";
  detailCustomer.textContent = matches[1] || "";
  detailTitle.textContent    = matches[2] || "";
  const plate = extractPlateDateField(text);
  detailPlateDate.textContent = plate;
  scanModeDiv.style.display = "none";
  caseDetailsDiv.style.display = "block";
}

// EnterでQR欄確定
caseBarcodeInput.addEventListener("keydown", e => {
  if(e.key !== "Enter") return;
  processCaseBarcode(caseBarcodeInput.value.trim());
});

// 手動入力モードと往復
startManualBtn.onclick = () => { scanModeDiv.style.display = "none"; manualModeDiv.style.display = "block"; };
startScanBtn.onclick   = () => { manualModeDiv.style.display = "none"; scanModeDiv.style.display  = "block"; };
manualConfirmBtn.onclick = () => {
  if(!manualOrderIdInput.value || !manualCustomerInput.value || !manualTitleInput.value){
    alert("必須項目を入力"); return;
  }
  const plateNorm = normalizeDateString(manualPlateDateInput.value);
  if(!plateNorm){ alert("下版日を入力してください（YYYY-MM-DD）"); return; }
  detailOrderId.textContent  = manualOrderIdInput.value.trim();
  detailCustomer.textContent = manualCustomerInput.value.trim();
  detailTitle.textContent    = manualTitleInput.value.trim();
  detailPlateDate.textContent = plateNorm;
  manualModeDiv.style.display = "none";
  caseDetailsDiv.style.display = "block";
};

/* ------------------------------
 * 暗号化ユーティリティ（AES-GCM + PBKDF2）
 * ------------------------------ */
const PEPPER = "p9r7WqZ1-LocalPepper-ChangeIfNeeded";
function b64(bytes){ return btoa(String.fromCharCode(...bytes)); }
function b64dec(str){ return new Uint8Array([...atob(str)].map(c=>c.charCodeAt(0))); }

async function deriveKey(uid, saltBytes){
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(uid + ":" + PEPPER),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt","decrypt"]
  );
}
async function encryptForUser(uid, payloadObj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(uid || "guest", salt);
  const data = new TextEncoder().encode(JSON.stringify(payloadObj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, data));
  return { iv: b64(iv), s: b64(salt), c: b64(ct) };
}
async function decryptForUser(uid, encObj){
  if (!encObj) return null;
  const iv = b64dec(encObj.iv);
  const salt = b64dec(encObj.s);
  const key = await deriveKey(uid || "guest", salt);
  const ct = b64dec(encObj.c);
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}

/* ------------------------------
 * 案件登録（案件情報 + 追跡）
 * ------------------------------ */
confirmAddCaseBtn.onclick = async () => {
  const orderId  = detailOrderId.textContent.trim();
  const customer = detailCustomer.textContent.trim();
  const title    = detailTitle.textContent.trim();
  const plateStr = (detailPlateDate.textContent || "").trim();
  const plateTs  = plateStr ? new Date(plateStr).getTime() : null;

  
  if (!plateStr || isNaN(new Date(plateStr).getTime())) { addCaseMsg.textContent = "下版日は必須です"; return; }
  if (!orderId || !customer || !title) { addCaseMsg.textContent = "情報不足"; return; }

  showLoading();
  confirmAddCaseBtn.disabled = true;
  anotherCaseBtn.disabled = true;

  try {
    // 既存追跡の重複抑止セット
    const snap = await db.ref(`shipments/${orderId}`).once("value");
    const existObj = snap.val() || {};
    const existSet = new Set(Object.values(existObj).map(it => `${it.carrier}:${it.tracking}`));
    const items = [];
    let missingCarrier = false;

    // 行強調リセット
    Array.from(trackingRows.children).forEach(row => row.classList.remove('missing-carrier'));

    // 入力走査（行<select>優先。未選択は固定値）
    Array.from(trackingRows.children).forEach(row => {
      const rowSelVal = row.querySelector("select")?.value || "";
      const fixedVal  = (fixedCarrierCheckbox?.checked ? (fixedCarrierSelect?.value || "") : "");
      const carrier   = rowSelVal || fixedVal || "";
      let tn = row.querySelector("input")?.value?.trim() || "";
      if (!tn) return;
      if (!carrier) { missingCarrier = true; row.classList.add('missing-carrier'); return; }
      tn = normalizeTrackingForSave(carrier, tn);
      const key = `${carrier}:${tn}`;
      if (existSet.has(key)) return;
      existSet.add(key);
      items.push({ carrier, tracking: tn });
    });

    if (missingCarrier) { addCaseMsg.textContent = "運送会社を選択してください（固定または行ごとに選択）"; return; }
    if (items.length === 0) { alert("新規追跡なし"); return; }

    // 案件情報を暗号化し保存
    const uid = (auth.currentUser && auth.currentUser.uid) || "guest";
    const enc = await encryptForUser(uid, { 得意先: customer, 品名: title, 下版日: plateStr || null });

    await db.ref(`cases/${orderId}`).set({
      注番: orderId,
      createdAt: Date.now(),
      plateDateTs: plateTs,
      enc
    });

    // 追跡を追加
    for (const it of items) {
      await db.ref(`shipments/${orderId}`).push({
        carrier: it.carrier,
        tracking: it.tracking,
        createdAt: Date.now()
      });
    }

    addCaseMsg.textContent = "登録完了";
    await showCaseDetail(orderId, { 注番: orderId, enc, plateDateTs: plateTs });
  } catch (err) {
    console.error(err);
    addCaseMsg.textContent = "登録に失敗しました";
  } finally {
    hideLoading();
    confirmAddCaseBtn.disabled = false;
    anotherCaseBtn.disabled = false;
  }
};

/* ------------------------------
 * 検索結果描画と全選択状態更新
 * ------------------------------ */
anotherCaseBtn.onclick = () => { showView("add-case-view"); initAddCaseView(); };
if (anotherCaseBtn2) anotherCaseBtn2.onclick = () => { showView("add-case-view"); initAddCaseView(); };

function renderSearchResults(list){
  searchResults.innerHTML = "";
  list.forEach(item => {
    const li = document.createElement("li");
    li.dataset.orderId = item.orderId;
    if(isAdmin){
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "select-case-checkbox";
      checkbox.dataset.orderId = item.orderId;
      li.appendChild(checkbox);
    }
    const span = document.createElement("span");
    span.textContent = `${item.orderId} / ${item.得意先 || ""} / ${item.品名 || ""} / 下版日:${item.下版日 || (item.plateDateTs ? new Date(item.plateDateTs).toLocaleDateString('ja-JP') : "")}`;
    li.appendChild(span);
    li.onclick = (e) => {
      if(e.target instanceof HTMLInputElement) return;
      showCaseDetail(item.orderId, item);
    };
    searchResults.appendChild(li);
  });
  deleteSelectedBtn.style.display = isAdmin ? "block" : "none";
  if (isAdmin) selectAllContainer.style.display = "block"; else selectAllContainer.style.display = "none";
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  const boxes = searchResults.querySelectorAll(".select-case-checkbox");
  boxes.forEach(cb => { cb.onchange = updateSelectAllState; });
  updateSelectAllState();
}
function updateSelectAllState() {
  if (!isAdmin) return;
  const boxes = searchResults.querySelectorAll(".select-case-checkbox");
  const checked = searchResults.querySelectorAll(".select-case-checkbox:checked");
  selectAllCheckbox.checked = (boxes.length > 0 && boxes.length === checked.length);
}

/* ------------------------------
 * 検索／全件一覧（createdAt or plateDateTs）
 * ------------------------------ */
function searchAll(kw=""){
  db.ref("cases").once("value").then(async snap => {
    const data = snap.val() || {};
    const res = [];
    const startVal = startDateInput.value;
    const endVal   = endDateInput.value;
    const basis    = (searchDateType && searchDateType.value) === 'created' ? 'createdAt' : 'plateDateTs';

    let startTs = null, endTs = null;
    if (startVal) startTs = new Date(startVal + 'T00:00:00').getTime();
    if (endVal)   endTs   = new Date(endVal   + 'T23:59:59').getTime();

    const uid = (auth.currentUser && auth.currentUser.uid) || "guest";

    for (const [orderId, obj] of Object.entries(data)) {
      const baseTs = obj[basis] ?? obj.createdAt ?? 0;
      if (startTs !== null && baseTs < startTs) continue;
      if (endTs   !== null && baseTs > endTs)   continue;

      // 復号（表示用）
      let view = { orderId, 注番: orderId, plateDateTs: obj.plateDateTs, createdAt: obj.createdAt };
      if (obj.enc) {
        try {
          const dec = await decryptForUser(uid, obj.enc);
          view.得意先 = dec?.得意先 || "";
          view.品名   = dec?.品名   || "";
          view.下版日 = dec?.下版日 || (obj.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
        } catch(_) {
          view.得意先 = obj.得意先 || "";
          view.品名   = obj.品名   || "";
          view.下版日 = obj.下版日 || "";
        }
      } else {
        view.得意先 = obj.得意先 || "";
        view.品名   = obj.品名   || "";
        view.下版日 = obj.下版日 || (obj.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
      }

      const matchKw = !kw || orderId.includes(kw) || (view.得意先 || "").includes(kw) || (view.品名 || "").includes(kw);
      if (!matchKw) continue;
      res.push(view);
    }

    // 登録日の新→古
    res.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    fullResults = res; currentPage = 1; renderPage();
  });
}

// 検索UI
searchBtn.onclick = () => {
  const kw = searchInput.value.trim();
  const hasKw = kw.length > 0;
  const hasPeriod = startDateInput.value || endDateInput.value;
  if (!hasKw && !hasPeriod) {
    searchAll("");
  } else {
    searchAll(kw);
  }
};
listAllBtn.onclick = () => {
  searchInput.value = "";
  startDateInput.value = "";
  endDateInput.value = "";
  pageSize = parseInt((pageSizeSelect && pageSizeSelect.value) || "50", 10) || 50;
  currentPage = 1;
  searchAll("");
};

/* ------------------------------
 * 管理者のみ：選択削除（cases と shipments の両方削除）
 * ------------------------------ */


// ▼ 追加：ページ描画とページングUI
function renderPage(){
  const total = fullResults.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const end   = start + pageSize;
  const slice = fullResults.slice(start, end);
  renderSearchResults(slice);
  renderPagination(total, totalPages);
}

function renderPagination(total, totalPages){
  if (!paginationDiv) return;
  paginationDiv.innerHTML = "";

  const first = document.createElement("button");
  first.textContent = "≪";
  first.title = "最初へ";
  first.disabled = currentPage <= 1;
  first.onclick = () => { currentPage = 1; renderPage(); };

  const prev = document.createElement("button");
  prev.textContent = "＜";
  prev.title = "前へ";
  prev.disabled = currentPage <= 1;
  prev.onclick = () => { currentPage--; renderPage(); };

  const info = document.createElement("div");
  const from = total === 0 ? 0 : ((currentPage - 1) * pageSize + 1);
  const to   = Math.min(currentPage * pageSize, total);
  info.id = "page-info";
  info.textContent = `${from}-${to} / ${total}件`;

  const pageInput = document.createElement("input");
  pageInput.type = "number";
  pageInput.id = "page-number-input";
  pageInput.min = 1;
  pageInput.max = totalPages;
  pageInput.value = String(currentPage);
  pageInput.title = `1〜${totalPages}`;
  pageInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      const v = Math.max(1, Math.min(totalPages, parseInt(pageInput.value||"1", 10) || 1));
      currentPage = v;
      renderPage();
    }
  };

  const gotoBtn = document.createElement("button");
  gotoBtn.textContent = "移動";
  gotoBtn.onclick = () => {
    const v = Math.max(1, Math.min(totalPages, parseInt(pageInput.value||"1", 10) || 1));
    currentPage = v;
    renderPage();
  };

  const totalLabel = document.createElement("span");
  totalLabel.textContent = ` / ${totalPages}ページ`;

  const next = document.createElement("button");
  next.textContent = "＞";
  next.title = "次へ";
  next.disabled = currentPage >= totalPages;
  next.onclick = () => { currentPage++; renderPage(); };

  const last = document.createElement("button");
  last.textContent = "≫";
  last.title = "最後へ";
  last.disabled = currentPage >= totalPages;
  last.onclick = () => { currentPage = totalPages; renderPage(); };

  paginationDiv.appendChild(first);
  paginationDiv.appendChild(prev);
  paginationDiv.appendChild(info);
  paginationDiv.appendChild(pageInput);
  paginationDiv.appendChild(totalLabel);
  paginationDiv.appendChild(gotoBtn);
  paginationDiv.appendChild(next);
  paginationDiv.appendChild(last);
}
deleteSelectedBtn.onclick = async () => {
  const checkboxes = searchResults.querySelectorAll(".select-case-checkbox:checked");
  const count = checkboxes.length;
  if (count === 0) return;
  if (count === 1) {
    const orderId = checkboxes[0].dataset.orderId;
    if (!confirm(`「${orderId}」を削除しますか？`)) return;
  } else {
    if (!confirm('選択案件を削除しますか？')) return;
  }
  for (const cb of checkboxes) {
    const orderId = cb.dataset.orderId;
    try {
      await db.ref(`cases/${orderId}`).remove();
      await db.ref(`shipments/${orderId}`).remove();
    } catch (e) { console.error(e); }
    cb.closest('li').remove();
  }
  updateSelectAllState();
};

/* ------------------------------
 * 追跡ステータス分類と表記生成
 * ------------------------------ */
function classifyStatus(status){
  const s = String(status || "");
  if (/(配達完了|お届け完了|配達済みです|配達済み)/.test(s)) return "delivered";
  if (/(配達中|お届け中|輸送中|移動中|配送中)/.test(s))          return "intransit";
  if (/(受付|荷受|出荷|発送|引受|持出|到着|作業中|準備中)/.test(s))  return "info";
  if (/(持戻|不在|保管|調査中|返送|破損|誤配送|エラー|該当なし|未登録)/.test(s)) return "exception";
  return "unknown";
}

// Cloudflare Worker 経由でステータス取得
async function fetchStatus(carrier, tracking) {
  const c = carrier;
  if (c === 'hida') return { status: '非対応', time: null };
  const sendTracking = trackingForApi(c, tracking);
  const url = `https://track-api.hr46-ksg.workers.dev/?carrier=${encodeURIComponent(c)}&tracking=${encodeURIComponent(sendTracking)}`;
  let res;
  try { res = await fetch(url); }
  catch (e) { console.error('fetch network error', { url, carrier: c, tracking: sendTracking, error: e }); throw e; }
  if (!res.ok) {
    const msg = await res.text().catch(()=> '');
    console.error('fetch http error', { url, status: res.status, body: msg });
    throw new Error(`HTTP ${res.status} ${msg}`);
  }
  return res.json();
}
function getTimeLabel(carrier, status, time) {
  if (!time || time.includes('：')) return '';
  if (carrier === 'seino') return (status === '配達済みです') ? '配達日時:' : '最新日時:';
  if (carrier === 'yamato' || carrier === 'tonami') {
    if (status === '配達完了' || status === 'お届け完了' || status === '配達済み') return '配達日時:';
    return '予定日時:';
  }
  if (status && status.includes('配達完了')) return '配達日時:';
  return '予定日時:';
}
function formatShipmentText(seqNum, carrier, tracking, status, time, location) {
  const label = carrierLabels[carrier] || carrier;
  const displayTracking = formatTrackingForDisplay(carrier, tracking);
  if (carrier === 'hida') return `${seqNum}：${label}：${displayTracking}：${status}`;
  const tl = getTimeLabel(carrier, status, time);
  if (location && String(location).trim() !== "") {
    if (time) return `${seqNum}：${label}：${displayTracking}：担当店名：${location}：${status}　${tl ? tl : ''}${time}`;
    return `${seqNum}：${label}：${displayTracking}：担当店名：${location}：${status}`;
  }
  if (time) return `${seqNum}：${label}：${displayTracking}：${status}　${tl ? tl : ''}${time}`;
  return `${seqNum}：${label}：${displayTracking}：${status}`;
}

/* ------------------------------
 * 案件詳細＋ステータス取得
 *  - pushキー昇順で描画し、非同期でもラベル連番を固定
 *  - 最後の fetch が終わるまでホイール維持
 * ------------------------------ */
async function showCaseDetail(orderId, obj){
  showLoading();
  showView("case-detail-view");

  // 復号＋ヘッダ表示
  let view = { 注番: orderId, 得意先: "", 品名: "", 下版日: "", plateDateTs: obj?.plateDateTs, createdAt: obj?.createdAt };
  try {
    if (obj && obj.enc) {
      const dec = await decryptForUser((auth.currentUser && auth.currentUser.uid) || "guest", obj.enc);
      view.得意先 = dec?.得意先 || "";
      view.品名   = dec?.品名   || "";
      view.下版日 = dec?.下版日 || (obj.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
    } else {
      view.得意先 = obj?.得意先 || "";
      view.品名   = obj?.品名   || "";
      view.下版日 = obj?.下版日 || (obj?.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
    }
  } catch(_) {}
  const plateView = view.下版日 || (view.plateDateTs ? new Date(view.plateDateTs).toLocaleDateString('ja-JP') : "");
  detailInfoDiv.innerHTML = `<div>受注番号: ${orderId}</div><div>得意先: ${view.得意先}</div><div>品名: ${view.品名}</div><div>下版日: ${plateView}</div>`;

  // 追跡一覧の初期化
  detailShipmentsUl.innerHTML = "";
  currentOrderId = orderId;
  addTrackingDetail.style.display = "none";
  try{ ensureFixedCarrierToolbar('detail'); }catch(_){}
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";
  if (detailAddRowBtn)     detailAddRowBtn.disabled = false;
  if (confirmDetailAddBtn) confirmDetailAddBtn.disabled = false;
  if (cancelDetailAddBtn)  cancelDetailAddBtn.disabled = false;

  showAddTrackingBtn.style.display = "inline-block";

  try {
    // pushキー昇順（= 追加順）で取得
    const snap = await db.ref(`shipments/${orderId}`).orderByKey().once("value");

    if (!snap.exists()) {
      const li = document.createElement("li");
      li.textContent = "追跡が登録されていません";
      li.className = "ship-empty";
      detailShipmentsUl.appendChild(li);
      return;
    }

    let lastStatusPromise = null;
    let rowSeq = 1; // 画面上の連番

    snap.forEach(child => {
      const it = child.val();
      const label = carrierLabels[it.carrier] || it.carrier;

      const seqNum = rowSeq++; // ここで確定しクロージャへ渡す

      const a = document.createElement("a");
      a.href = it.carrier === 'hida'
        ? carrierUrls[it.carrier]
        : (carrierUrls[it.carrier] + encodeURIComponent(it.tracking));
      a.target = "_blank";
      a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：読み込み中…`;

      const li = document.createElement("li");
      li.appendChild(a);
      detailShipmentsUl.appendChild(li);

      const p = fetchStatus(it.carrier, it.tracking)
        .then(({ status, time, location }) => {
          a.textContent = formatShipmentText(seqNum, it.carrier, it.tracking, status, time, location);
          li.className = "ship-" + classifyStatus(status);
        })
        .catch(err => {
          console.error("fetchStatus error:", err);
          a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：取得失敗`;
          li.className = "ship-exception";
        });

      lastStatusPromise = p;
    });

    if (lastStatusPromise) await lastStatusPromise;
  } finally {
    hideLoading();
  }
}

backToSearchBtn.onclick = () => showView("search-view");

/* ------------------------------
 * 追跡番号追加（詳細画面）
 *  - 行<select>優先、未選択は固定値。
 *  - 追加後は最後のステータス反映までホイール維持
 * ------------------------------ */
showAddTrackingBtn.onclick = () => {
  
  
  // 固定キャリアを初期化
  try { if (typeof fixedCarrierCheckboxDetail !== 'undefined' && fixedCarrierCheckboxDetail) fixedCarrierCheckboxDetail.checked = false; } catch(_) {}
  try { if (typeof fixedCarrierSelectDetail   !== 'undefined' && fixedCarrierSelectDetail) { fixedCarrierSelectDetail.value=''; fixedCarrierSelectDetail.style.display='none'; } } catch(_) {}
// 追跡追加パネルを開く＋必須ボタンを確実に表示
  try { if (addTrackingDetail) addTrackingDetail.style.display = 'block'; } catch(_) {}
  try { if (detailAddMsg) detailAddMsg.textContent = ''; } catch(_) {}
  try {
    if (detailTrackingRows){
      detailTrackingRows.innerHTML = '';
      for (let i = 0; i < 5; i++) detailTrackingRows.appendChild(createTrackingRow('detail'));
    renumberTrackingRows('detail');
    ensureFixedCarrierToolbar('detail');
    }
  } catch(_) {}
  try { if (confirmDetailAddBtn) { confirmDetailAddBtn.style.display = 'inline-block'; confirmDetailAddBtn.disabled = false; } } catch(_) {}
  try { if (cancelDetailAddBtn)  { cancelDetailAddBtn.style.display  = 'inline-block'; cancelDetailAddBtn.disabled  = false; } } catch(_) {}
  try { if (showAddTrackingBtn)  { showAddTrackingBtn.style.display  = 'none'; } } catch(_) {}

};
detailAddRowBtn.onclick = () => { for (let i = 0; i < 5; i++) detailTrackingRows.appendChild(createTrackingRow("detail")); renumberTrackingRows('detail'); };
cancelDetailAddBtn.onclick = () => {
  addTrackingDetail.style.display = "none";
  try{ ensureFixedCarrierToolbar('detail'); }catch(_){}
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";
  showAddTrackingBtn.style.display = "inline-block";

  // 固定キャリア初期化
  if (fixedCarrierCheckboxDetail) fixedCarrierCheckboxDetail.checked = false;
  if (fixedCarrierSelectDetail) {
    fixedCarrierSelectDetail.value = ""; // 運送会社選択してください を選択
    fixedCarrierSelectDetail.style.display = "none";
  }
};

function getFixedCarrierValue(){
  const detailOn = !!(window.fixedCarrierCheckboxDetail && fixedCarrierCheckboxDetail.checked);
  const commonOn = !!(window.fixedCarrierCheckbox && fixedCarrierCheckbox.checked);
  if (detailOn)  return (window.fixedCarrierSelectDetail && fixedCarrierSelectDetail.value) || "";
  if (commonOn)  return (window.fixedCarrierSelect && fixedCarrierSelect.value) || "";
  return "";
}

// 追跡番号追加 確定
document.addEventListener("DOMContentLoaded", () => {
  if (!confirmDetailAddBtn) { console.error("#confirm-detail-add-btn が見つかりません"); return; }

  confirmDetailAddBtn.onclick = async () => {
    showLoading();
    confirmDetailAddBtn.disabled = true;
    detailAddRowBtn.disabled = true;
    cancelDetailAddBtn.disabled = true;
    detailAddMsg.textContent = "";
    const detailAddWarn = document.getElementById("detailAddWarn");
    if (detailAddWarn) detailAddWarn.textContent = "";

    try {
      if (!currentOrderId) throw new Error("currentOrderId 未設定");

      // 既存重複の抑止
      const snap = await db.ref(`shipments/${currentOrderId}`).once("value");
      const exist = snap.val() || {};
      const existSet = new Set(Object.values(exist).map(v => `${v.carrier}:${v.tracking}`));

      // 固定値（空でも可）
      const fixedVal = getFixedCarrierValue();

      // 入力集約（行<select>優先。未選択は固定値）
      const rows = Array.from(detailTrackingRows.querySelectorAll(".tracking-row"));
      rows.forEach(r => r.classList.remove("missing-carrier"));

      const items = [];
      let missingCarrier = false;

      for (const r of rows) {
        const rowSelVal = r.querySelector("select")?.value || "";
        const carrier = rowSelVal || fixedVal || "";
        let tracking  = (r.querySelector('input[type="text"]')?.value || "").trim();

        if (!tracking) continue;
        if (!carrier) { missingCarrier = true; r.classList.add("missing-carrier"); continue; }

        tracking = normalizeTrackingForSave(carrier, tracking);
        const k = `${carrier}:${tracking}`;
        if (existSet.has(k)) continue;
        existSet.add(k);
        items.push({ carrier, tracking });
      }

      if (missingCarrier) {
        const msg = "運送会社を選択してください（固定または行ごとに選択）";
        detailAddMsg.textContent = msg;
        if (detailAddWarn) detailAddWarn.textContent = msg;
        return;
      }
      if (items.length === 0) { detailAddMsg.textContent = "追加対象がありません"; return; }

      // DB 登録（並列）
      const ref = db.ref(`shipments/${currentOrderId}`);
      await Promise.all(items.map(it => ref.push({ carrier: it.carrier, tracking: it.tracking, createdAt: Date.now() })));

      // 即時描画＋ステータス反映
      let seqBase = detailShipmentsUl.children.length;
      let lastP = null;
      for (const it of items) {
        const li = document.createElement("li");
        const label = carrierLabels[it.carrier] || it.carrier;
        const a = document.createElement("a");
        a.target = "_blank";
        a.href = it.carrier === "hida" ? carrierUrls[it.carrier] : (carrierUrls[it.carrier] + encodeURIComponent(it.tracking));
        a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：読み込み中…`;
        li.appendChild(a);
        detailShipmentsUl.appendChild(li);

        const p = fetchStatus(it.carrier, it.tracking)
          .then(({ status, time, location }) => {
            const seq = ++seqBase;
            a.textContent = formatShipmentText(seq, it.carrier, it.tracking, status, time, location);
            li.className = "ship-" + classifyStatus(status);
          })
          .catch(e => {
            console.error(e);
            a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：取得失敗`;
            li.className = 'ship-exception';
          });

        lastP = p;
      }
      if (lastP) await lastP;

      // 追加登録完了時のUI処理
      detailAddMsg.textContent = "追加しました";
      if (detailAddWarn) detailAddWarn.textContent = "";
      
      // 固定キャリア状態をリセット
      if (fixedCarrierCheckboxDetail) fixedCarrierCheckboxDetail.checked = false;
      if (fixedCarrierSelectDetail) {
        fixedCarrierSelectDetail.value = ""; // 運送会社選択してください を選択
        fixedCarrierSelectDetail.style.display = "none";
      }
      
      // 追跡番号入力行をクリア
      detailTrackingRows.innerHTML = "";
      
      // 次回追加時も初期化状態で表示
      addTrackingDetail.style.display = "none";
  try{ ensureFixedCarrierToolbar('detail'); }catch(_){}
      showAddTrackingBtn.style.display = "inline-block";
      
    } catch (e) {
      const msg = `追加に失敗しました: ${e.message || e}`;
      detailAddMsg.textContent = msg;
      const warn = document.getElementById("detailAddWarn");
      if (warn) warn.textContent = msg;
      console.error("追跡番号追加エラー:", e);
    } finally {
      hideLoading();
      if (detailAddRowBtn)     detailAddRowBtn.disabled = false;
      if (confirmDetailAddBtn) confirmDetailAddBtn.disabled = false;
      if (cancelDetailAddBtn)  cancelDetailAddBtn.disabled = false;
    }
  };
});

/* ------------------------------
 * 初期表示（ログイン状態に応じてビュー切替）
 * ------------------------------ */
auth.onAuthStateChanged(async user => {
  if (user) {
    try {
      const snap = await db.ref(`admins/${user.uid}`).once("value");
      isAdmin = snap.val() === true;
    } catch (e) {
      console.error("管理者判定エラー:", e);
      isAdmin = false;
    }
    loginView.style.display = "none";
    signupView.style.display = "none";
    mainView.style.display = "block";
    showView('add-case-view');
    showView("add-case-view");
    initAddCaseView();
    startSessionTimer();
    deleteSelectedBtn.style.display = isAdmin ? "block" : "none";
  } else {
    isAdmin = false;
    loginView.style.display = "block";
    signupView.style.display = "none";
    mainView.style.display = "none";
  }
});

/* ------------------------------
 * セッション延長タイマー
 * ------------------------------ */
function resetSessionTimer() {
  try { markLoginTime(); } catch (_) {}
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    alert('セッションが10分を超えました。再度ログインしてください。');
    try { if (auth && auth.currentUser) auth.signOut(); } catch (_) {}
    try { if (emailInput) emailInput.value = ""; } catch (_) {}
    try { if (passwordInput) passwordInput.value = ""; } catch (_) {}
    try { localStorage.removeItem('loginTime'); } catch (_) {}
  }, SESSION_LIMIT_MS);
}
function startSessionTimer() {
  resetSessionTimer();
  ['click','keydown','touchstart','input','change'].forEach(evt =>
    document.addEventListener(evt, resetSessionTimer, true));
  if (!window.__inactivityInterval) {
    window.__inactivityInterval = setInterval(() => {
      try {
        if (auth && auth.currentUser && isSessionExpired()) {
          alert('セッションが10分を超えました。再度ログインしてください。');
          auth.signOut().catch(()=>{});
          clearInterval(window.__inactivityInterval);
          window.__inactivityInterval = null;
        }
      } catch (_) {}
    }, 30 * 1000);
  }
}

// Enter でログイン
if (passwordInput) {
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (loginBtn) loginBtn.click(); }
  });
}

// --- 固定キャリア(詳細)の委譲ハンドラ ---
document.addEventListener('change', (e) => {
  const t = e.target;
  if (!t || t.id !== 'fixed-carrier-checkbox-detail') return;
  try {
    if (typeof fixedCarrierSelectDetail !== 'undefined' && fixedCarrierSelectDetail) {
      fixedCarrierSelectDetail.style.display = t.checked ? 'inline-block' : 'none';
    }
    if (typeof applyFixedToUnselectedRows === 'function') applyFixedToUnselectedRows('detail');
  } catch(_) {}
}, true);


// === 初期表示でもサイズ調整を走らせる ===
function requestFitAll(){
  try { window.dispatchEvent(new Event('resize')); } catch(_){}
}
document.addEventListener('DOMContentLoaded', () => setTimeout(requestFitAll, 0));
try{
  if (typeof showView === 'function'){
    const __origShowView = showView;
    window.showView = function(id){ __origShowView(id); if(id==='add-view'||id==='detail-view') setTimeout(requestFitAll, 0); };
  }
}catch(_){}