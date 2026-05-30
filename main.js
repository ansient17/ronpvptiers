<!-- SINGLE MERGED SCRIPT - fixes the "window.firebaseCollection is not a function" error -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  // ===== FIREBASE CONFIG - replace apiKey with your value from Firebase Console =====
  const firebaseConfig = {
    apiKey: "AIzaSyDXizCKjNllkPjVRSnufHN6J3AHuI7VxtE",
    authDomain: "ronsmpranked.firebaseapp.com",
    projectId: "ronsmpranked",
    storageBucket: "ronsmpranked.firebasestorage.app",
    messagingSenderId: "584733636636",
    appId: "1:584733636636:web:f8612a2133e4d2f3ff09"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ===== CONSTANTS =====
  const TIER_PTS = {HT1:60,LT1:45,HT2:30,LT2:15,HT3:10,LT3:6,HT4:4,LT4:3,HT5:2,LT5:1};
  const TIER_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];

  // ===== STATE =====
  let currentTab = "Overall";
  let loggedInUser = null;
  let players = [];
  let editingIndex = null;
  let uuidCache = {};

  // ===== FIREBASE FUNCTIONS =====
  async function fetchUUIDs() {
    const names = players.map(p => p.name).filter(n => !uuidCache[n.toLowerCase()]);
    for (const name of names) {
      try {
        const r = await fetch(https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(name)});
        const data = await r.json();
        if (data && data.uuid) uuidCache[name.toLowerCase()] = data.uuid.replace(/-/g, "");
      } catch(e) {}
    }
    renderBoard();
  }

  function loadPlayersFromFirebase() {
    const playersCollection = collection(db, "players");
    onSnapshot(playersCollection, (snapshot) => {
      players = [];
      snapshot.forEach(d => {
        players.push({ id: d.id, ...d.data() });
      });
      renderBoard();
      fetchUUIDs();
      if (loggedInUser) renderEditList();
    });
  }

  // ===== SCORE CALCULATION =====
  function calcScore(p) {
    let s = 0;
    ["Sword","UHC","SMP","Mace"].forEach(k => { if(p.tiers && p.tiers[k]) s += TIER_PTS[p.tiers[k]] || 0; });
    return s;
  }

  // ===== TAB / SETTINGS =====
  function setTab(el, name) {
    if (el) {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      el.classList.add("active");
    }
    currentTab = name;
    renderBoard();
  }
  window.setTab = setTab;

  function openSettings(e) {
    e && e.stopPropagation();
    document.getElementById("settingsBtn").classList.add("active");
    document.getElementById("settingsOverlay").classList.add("open");
    if (loggedInUser) {
      document.getElementById("settingsLogin").style.display = "none";
      document.getElementById("adminPanel").style.display = "block";
      renderEditList();
    } else {
      document.getElementById("settingsLogin").style.display = "block";
      document.getElementById("adminPanel").style.display = "none";
    }
  }
  window.openSettings = openSettings;

  function closeSettings() {
    document.getElementById("settingsOverlay").classList.remove("open");
    document.getElementById("settingsBtn").classList.remove("active");
  }
  window.closeSettings = closeSettings;

  function handleSettingsOverlayClick(e) {
    if (e.target === document.getElementById("settingsOverlay")) closeSettings();
  }
  window.handleSettingsOverlayClick = handleSettingsOverlayClick;

  // ===== RENDER FUNCTIONS =====
  function skinHTML(name, size) {
    return <img src="https://mc-heads.net/bust/${encodeURIComponent(name)}/100" alt="" style="height:${size}px;width:auto;image-rendering:pixelated;" onerror="this.style.display='none'"/>;
  }

  function chevronSkin(name, rankClass) {
    return <div class="skin-chevron ${rankClass}">${skinHTML(name,80)}</div>;
  }

  function renderBoard() {
    const ov = document.getElementById("overallView");
    const cv = document.getElementById("categoryView");
    if (currentTab === "Overall") {
      cv.style.display = "none";
      ov.style.display = "grid";
      renderOverall();
    } else {
      ov.style.display = "none";
      cv.style.display = "block";
      renderCategoryTiers(currentTab);
    }
  }

  function renderOverall() {
    const body = document.getElementById("boardBody");
    let list = [...players].sort((a,b) => calcScore(b) - calcScore(a));
    if (list.length === 0) {
      body.innerHTML = <div class="empty"><h1>No Players Yet</h1><p>Players will appear here once added through the Admin panel.</p></div>;
      return;
    }
    const categoryEmoji = {Sword:"⚔️",UHC:"❤️",SMP:"💀",Mace:"🔨"};
    body.innerHTML = list.map((p,i) => {
      const rankCls = i===0 ? "rank r1" : i===1 ? "rank r2" : i===2 ? "rank r3" : "rank";
      const rowCls = i===0 ? "player-row top1" : i===1 ? "player-row top2" : i===2 ? "player-row top3" : "player-row";
      const badges = ["Sword","UHC","SMP","Mace"].filter(k => p.tiers && p.tiers[k])
        .map(k => <span class="tier-badge">${p.tiers[k]}<span style="font-size:18px;margin-left:4px;">${categoryEmoji[k]}</span></span>).join("");
      const pts = calcScore(p);
      let skinCol;
      if (i===0) skinCol = chevronSkin(p.name,"c1");
      else if (i===1) skinCol = chevronSkin(p.name,"c2");
      else if (i===2) skinCol = chevronSkin(p.name,"c3");
      else skinCol = <div class="skin-wrap">${skinHTML(p.name,72)}</div>;
      return `<div class="${rowCls}" onclick="openProfile('${esc(p.name)}')">
        <div class="${rankCls}">#${i+1}</div>
        ${skinCol}
        <div class="player-name">${esc(p.name)}</div>
        <div class="region">${esc(p.region || "EU")}</div>
        <div class="points-col">${pts}</div>
        <div class="tiers">${badges || '<span style="color:#333;">—</span>'}</div>
      </div>`;
    }).join("");
  }

  function renderCategoryTiers(cat) {
    const body = document.getElementById("tierColsBody");
    const tierMap = {};
    TIER_ORDER.forEach(t => tierMap[t] = []);
    players.forEach(p => {
      const t = p.tiers && p.tiers[cat];
      if (t && tierMap[t]) tierMap[t].push(p);
    });
    const hasAny = TIER_ORDER.some(t => tierMap[t].length > 0);
    if (!hasAny) {
      body.innerHTML = <div class="empty"><h1>No Players Yet</h1><p>No players have been assigned a ${cat} tier yet.</p></div>;
      return;
    }
    const chevSVG = <svg viewBox="0 0 20 12" fill="none"><polyline points="2,10 10,2 18,10" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>;
    const htChevron = <div class="tier-chevron chev-ht">${chevSVG}${chevSVG}</div>;
    const ltChevron = <div class="tier-chevron chev-lt">${chevSVG}</div>;
    const makeRow = (p, isHT) => `<div class="tier-player-item ${isHT ? 'is-ht' : 'is-lt'}" onclick="openProfile('${esc(p.name)}')">
      <div class="tier-player-skin">${skinHTML(p.name,46)}</div>
      <div class="tier-player-name">${esc(p.name)}</div>
      ${isHT ? htChevron : ltChevron}
    </div>`;
    const trophies = ["🏆","🥈","🥉","🎖️","🎗️"];
    body.innerHTML = [1,2,3,4,5].map(n => {
      const htList = tierMap["HT"+n] || [];
      const ltList = tierMap["LT"+n] || [];
      const rows = [...htList.map(p => makeRow(p,true)), ...ltList.map(p => makeRow(p,false))].join("");
      return `<div class="tier-col tcol-${n}">
        <div class="tier-col-header">
          <span class="tier-col-trophy">${trophies[n-1]}</span>
          <span class="tier-col-title">Tier ${n}</span>
          <span class="tier-col-count">${htList.length + ltList.length}</span>
        </div>
        ${rows || '<div style="padding:24px;color:#333;">No players</div>'}
      </div>`;
    }).join("");
  }

  function renderEditList() {
    const el = document.getElementById("playerEditList");
    if (!players.length) { el.innerHTML = ""; return; }
    el.innerHTML = <div style="font-size:22px;color:var(--sub);margin-bottom:12px;">Existing players (${players.length})</div> +
      players.map((p,i) => `<div class="player-edit-row">
        <div class="pname">${esc(p.name)}</div>
        <div style="font-size:22px;color:var(--sub);">${p.region || "EU"}</div>
        <div style="font-size:22px;">${Object.entries(p.tiers || {}).filter(([,v])=>v).map(([k,v])=>${v}).join(" ")}</div>
        <button class="btn-edit-ico" onclick="openEdit('${p.id}')">✎ Edit</button>
        <button class="btn-del-ico" onclick="deletePlayer('${p.id}')">✕</button>
      </div>`).join("");
  }

  // ===== LOGIN / LOGOUT =====
  async function doLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPass").value;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      loggedInUser = userCredential.user.email;
      document.getElementById("editingAs").textContent = loggedInUser;
      document.getElementById("settingsLogin").style.display = "none";
      document.getElementById("adminPanel").style.display = "block";
      renderEditList();
      document.getElementById("loginErr").textContent = "";
    } catch (error) {
      document.getElementById("loginErr").textContent = "Invalid email or password.";
    }
  }
  window.doLogin = doLogin;

  function logout() {
    signOut(auth);
    loggedInUser = null;
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("settingsLogin").style.display = "block";
    document.getElementById("loginPass").value = "";
    document.getElementById("loginErr").textContent = "";
  }
  window.logout = logout;

  // ===== PLAYER MANAGEMENT =====
  async function addPlayer() {
    if (!loggedInUser) return;
    const name = document.getElementById("newName").value.trim();
    if (!name) { document.getElementById("addErr").textContent = "Player name required."; return; }
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      document.getElementById("addErr").textContent = "Player already exists.";
      return;
    }
    const addBtn = document.querySelector(".btn-add");
    addBtn.disabled = true;
    addBtn.textContent = "Checking...";
    document.getElementById("addErr").textContent = "";
    let resolvedName = name;
    try {
      const r = await fetch(https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(name)});
      if (r.status === 404) throw new Error("Not found");
      const data = await r.json();
      if (!data || !data.uuid) throw new Error("Invalid");
      if (data.username) resolvedName = data.username;
      uuidCache[resolvedName.toLowerCase()] = data.uuid.replace(/-/g, "");
    } catch(e) {
      document.getElementById("addErr").textContent = "${name}" is not a valid Minecraft account.;
      addBtn.disabled = false;
      addBtn.textContent = "+ Add";
      return;
    }
    const newPlayer = {
      name: resolvedName,
      region: document.getElementById("newRegion").value,
      tiers: {
        Sword: document.getElementById("newSword").value || null,
        UHC: document.getElementById("newUHC").value || null,
        SMP: document.getElementById("newSMP").value || null,
        Mace: document.getElementById("newMace").value || null
      }
    };
    const newDocRef = doc(collection(db, "players"), resolvedName.toLowerCase());
    await setDoc(newDocRef, newPlayer);
    document.getElementById("newName").value = "";
    document.getElementById("newSword").value = "";
    document.getElementById("newUHC").value = "";
    document.getElementById("newSMP").value = "";
    document.getElementById("newMace").value = "";
    addBtn.disabled = false;
    addBtn.textContent = "+ Add";
  }
  window.addPlayer = addPlayer;

  async function deletePlayer(playerId) {
    if (!loggedInUser) return;
    const playerRef = doc(db, "players", playerId);
    await deleteDoc(playerRef);
  }
  window.deletePlayer = deletePlayer;

  function openEdit(playerId) {
    const p = players.find(p => p.id === playerId);
    if (!p) return;
    editingIndex = playerId;
    const opts = (tier) => ["","HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"].map(v =>
      <option value="${v}" ${(p.tiers && p.tiers[tier]) === v ? "selected" : ""}>${v || "—"}</option>
    ).join("");
    const regOpts = ["EU","AS","NA","SA","OC"].map(r => <option ${p.region === r ? "selected" : ""}>${r}</option>).join("");
    showModal(`<h2>Edit Player</h2><p>Editing: <b style="color:var(--gold)">${esc(p.name)}</b></p>
      <div class="field"><label>Region</label><select id="eRegion">${regOpts}</select></div>
      <div class="field"><label>Sword</label><select id="eSword">${opts("Sword")}</select></div>
      <div class="field"><label>UHC</label><select id="eUHC">${opts("UHC")}</select></div>
      <div class="field"><label>SMP</label><select id="eSMP">${opts("SMP")}</select></div>
      <div class="field"><label>Mace</label><select id="eMace">${opts("Mace")}</select></div>
      <div class="btn-row"><button class="btn btn-cancel" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveEdit()">Save</button></div>`);
  }
  window.openEdit = openEdit;

  async function saveEdit() {
    const playerRef = doc(db, "players", editingIndex);
    const p = players.find(p => p.id === editingIndex);
    const updatedPlayer = {
      ...p,
      region: document.getElementById("eRegion").value,
      tiers: {
        Sword: document.getElementById("eSword").value || null,
        UHC: document.getElementById("eUHC").value || null,
        SMP: document.getElementById("eSMP").value || null,
        Mace: document.getElementById("eMace").value || null
      }
    };
    await setDoc(playerRef, updatedPlayer);
    closeModal();
  }
  window.saveEdit = saveEdit;

  // ===== PROFILE =====
  function openProfile(name) {
    const p = players.find(pl => pl.name === name);
    if (!p) return;
    const pts = calcScore(p);
    const sorted = [...players].sort((a,b) => calcScore(b) - calcScore(a));
    const rank = sorted.findIndex(pl => pl.name === name) + 1;
    const catEmoji = {Sword:"⚔️",UHC:"❤️",SMP:"💀",Mace:"🔨"};
    const tierColorMap = {HT1:"#F7C725",LT1:"#C7A63C",HT2:"#5b58ff",LT2:"#7b79e0",HT3:"#ff9d47",LT3:"#ffb14a",HT4:"#e03030",LT4:"#a02020",HT5:"#aaaaaa",LT5:"#606060"};
    document.getElementById("profileHeader").innerHTML = `
      <div class="profile-avatar-wrap"><img src="https://mc-heads.net/bust/${encodeURIComponent(name)}/100" alt="" onerror="this.style.display='none'" style="height:175px;"/></div>
      <div class="profile-name">${esc(name)}</div>
      <div class="profile-region">${esc(p.region || "EU")}</div>
      <button class="profile-namemc" onclick="window.open('https://namemc.com/profile/${encodeURIComponent(name)}','_blank')">🔗 NameMC</button>`;
    const tiersHtml = ["Sword","UHC","SMP","Mace"].map(cat => {
      const val = p.tiers && p.tiers[cat];
      const col = val ? tierColorMap[val] : "#333";
      return <div class="profile-tier-item"><div class="profile-tier-icon">${catEmoji[cat]}</div><div class="profile-tier-cat">${cat}</div><div class="profile-tier-val" style="color:${col}">${val || "—"}</div></div>;
    }).join("");
    document.getElementById("profileBody").innerHTML = `
      <div class="profile-section-title">Position</div>
      <div class="profile-position-pill"><span class="profile-position-num">${rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : "#"+rank}</span><span>OVERALL</span><span class="profile-position-pts">${pts} pts</span></div>
      <div class="profile-section-title">Tiers</div>
      <div class="profile-tiers-grid">${tiersHtml}</div>`;
    document.getElementById("profileOverlay").classList.add("open");
  }
  window.openProfile = openProfile;

  function closeProfile() {
    document.getElementById("profileOverlay").classList.remove("open");
  }
  window.closeProfile = closeProfile;

  // ===== MODALS / MISC =====
  function showModal(html) {
    document.getElementById("modalBox").innerHTML = html;
    document.getElementById("overlay").style.display = "flex";
  }

  function closeModal() {
    document.getElementById("overlay").style.display = "none";
  }
  window.closeModal = closeModal;

  function toggleDiscord(e) {
    e.stopPropagation();
    document.getElementById("discordDropdown").classList.toggle("open");
  }
  window.toggleDiscord = toggleDiscord;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  document.addEventListener("click", () => document.getElementById("discordDropdown").classList.remove("open"));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSettings(); closeModal(); closeProfile(); } });

  // ===== INIT =====
  loadPlayersFromFirebase();
</script>