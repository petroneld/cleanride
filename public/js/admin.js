// ==== CHECK ADMIN ====
async function checkAdmin(){
  const res = await fetch("/api/admin/me");
  const data = await res.json();
  if(!data.isAdmin) window.location.href="/login";
}

// ==== LOAD BOOKINGS ====
async function loadBookings(){
  const tbody = document.getElementById("bookingsBody");
  const info = document.getElementById("bookingsInfo");

  tbody.innerHTML = "<tr><td colspan='8'>Se încarcă...</td></tr>";

  try{
    const res = await fetch("/api/admin/bookings");
    const data = await res.json();

    if(!data.bookings || data.bookings.length === 0){
      tbody.innerHTML = "<tr><td colspan='8'>Nu există rezervări.</td></tr>";
      info.textContent = "Nu există rezervări viitoare.";
      return;
    }

    info.textContent = `${data.bookings.length} rezervări viitoare.`;
    tbody.innerHTML = "";

    data.bookings.forEach(b => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.date}</td>
        <td>${b.timeSlot}</td>
        <td><span class="badge">${b.serviceType}</span></td>
        <td>${b.name}</td>
        <td>${b.phone}</td>
        <td>${b.email}</td>
        <td>${b.address}</td>
        <td>${b.notes || ""}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch(err){
    info.textContent = "Eroare la încărcarea rezervărilor.";
    console.error(err);
  }
}

// ==== STATS ====
async function loadStats(){
  try{
    const res = await fetch("/api/admin/stats");
    const data = await res.json();

    const s1 = document.getElementById("statsService");
    const s2 = document.getElementById("statsDay");
    const s3 = document.getElementById("statsRevenue");

    s1.innerHTML = "";
    s2.innerHTML = "";
    s3.innerHTML = "";

    data.perService.forEach(x => {
      s1.innerHTML += `<div>${x.serviceType}: ${x.count}</div>`;
    });

    data.perDay.forEach(x => {
      s2.innerHTML += `<div>${x.date}: ${x.count}</div>`;
    });

    s3.textContent = data.revenue + " lei";

  } catch(err){
    console.error(err);
  }
}

// ==== BLOCKS ====
async function loadBlocks(){
  const d = document.getElementById("blockedDays");
  const s = document.getElementById("blockedSlots");

  d.innerHTML = "Se încarcă...";
  s.innerHTML = "Se încarcă...";

  const res = await fetch("/api/admin/blocks");
  const data = await res.json();

  d.innerHTML = "";
  s.innerHTML = "";

  // days
  if(data.blockedDays.length === 0){
    d.textContent = "—";
  } else {
    data.blockedDays.forEach(x => {
      const el = document.createElement("div");
      el.className = "badge";
      el.style.margin = "4px";
      el.innerHTML = `${x.date} (${x.reason || "fără motiv"}) 
        <a href="#" onclick="unblock('day',${x.id});return false;">✕</a>`;
      d.appendChild(el);
    });
  }

  // slots
  if(data.blockedSlots.length === 0){
    s.textContent = "—";
  } else {
    data.blockedSlots.forEach(x => {
      const el = document.createElement("div");
      el.className = "badge";
      el.style.margin = "4px";
      el.innerHTML = `${x.date} ${x.timeSlot} (${x.reason || "fără motiv"}) 
        <a href="#" onclick="unblock('slot',${x.id});return false;">✕</a>`;
      s.appendChild(el);
    });
  }
}

// ==== ACTIONS ====
async function blockDay(){
  const date = document.getElementById("blockDayDate").value;
  const reason = document.getElementById("blockDayReason").value;

  if(!date) return alert("Alege o dată.");

  await fetch("/api/admin/block-day", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({date,reason})
  });

  loadBlocks();
}

async function blockSlot(){
  const date = document.getElementById("blockSlotDate").value;
  const time = document.getElementById("blockSlotTime").value;
  const reason = document.getElementById("blockSlotReason").value;

  if(!date || !time) return alert("Alege dată și slot.");

  await fetch("/api/admin/block-slot", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({date,timeSlot:time,reason})
  });

  loadBlocks();
}

async function unblock(type,id){
  await fetch("/api/admin/unblock", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({type,id})
  });

  loadBlocks();
}

function logout(){
  fetch("/api/admin/logout",{method:"POST"});
  window.location.href="/login";
}

function exportCSV(){
  window.location.href="/api/admin/export";
}

// ==== INIT ====
(async function(){
  await checkAdmin();
  await loadBookings();
  await loadStats();
  await loadBlocks();
})();
