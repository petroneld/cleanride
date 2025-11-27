// PRICE TABLE
const PRICE_MAP = {
  Basic: 150,
  Standard: 250,
  Premium: 350,
};

// Helpers scroll
function scrollToBooking() {
  const el = document.getElementById("booking");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function scrollToServices() {
  const el = document.getElementById("services");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

// Wizard state
let currentStep = 1;

// DOM refs
const stepElems = document.querySelectorAll(".wizard-step");
const panelElems = document.querySelectorAll(".wizard-panel");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");

const bookingDateInput = document.getElementById("bookingDate");
const timeSlotSelect = document.getElementById("timeSlot");
const slotStatus = document.getElementById("slotStatus");

const msgBox = document.getElementById("bookingMessage");

// summary elements
const summaryService = document.getElementById("summaryService");
const summaryPrice = document.getElementById("summaryPrice");
const summaryDate = document.getElementById("summaryDate");
const summaryTime = document.getElementById("summaryTime");
const summaryName = document.getElementById("summaryName");
const summaryAddress = document.getElementById("summaryAddress");

// init year in footer
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// set min date = today
if (bookingDateInput) {
  const today = new Date().toISOString().slice(0, 10);
  bookingDateInput.min = today;
}

// Update UI
function updateWizardUI() {
  stepElems.forEach((step) => {
    const stepId = Number(step.dataset.step);
    step.classList.toggle("active", stepId === currentStep);
  });

  panelElems.forEach((panel) => {
    const stepId = Number(panel.dataset.stepPanel);
    panel.classList.toggle("active", stepId === currentStep);
  });

  btnPrev.disabled = currentStep === 1;
  btnNext.textContent = currentStep === 3 ? "Trimite rezervarea" : "Continuă";

  // Live summary
  const serviceType = getSelectedService();

  summaryService.textContent = serviceType || "—";
  summaryPrice.textContent = serviceType ? PRICE_MAP[serviceType] + " lei" : "—";

  summaryDate.textContent = bookingDateInput.value || "—";
  summaryTime.textContent = timeSlotSelect.value || "—";
  summaryName.textContent = document.getElementById("clientName").value || "—";
  summaryAddress.textContent =
    document.getElementById("clientAddress").value || "—";
}

// Get service selection
function getSelectedService() {
  const checked = document.querySelector('input[name="serviceType"]:checked');
  return checked ? checked.value : "";
}

// Validation
function validateStep(step) {
  msgBox.className = "booking-message";
  msgBox.textContent = "";

  if (step === 1 && !getSelectedService()) {
    msgBox.classList.add("error");
    msgBox.textContent = "Te rugăm să alegi un pachet.";
    return false;
  }

  if (step === 2) {
    if (!bookingDateInput.value) {
      msgBox.classList.add("error");
      msgBox.textContent = "Alege o dată.";
      return false;
    }
    if (!timeSlotSelect.value) {
      msgBox.classList.add("error");
      msgBox.textContent = "Alege un interval disponibil.";
      return false;
    }
  }

  if (step === 3) {
    const name = document.getElementById("clientName").value.trim();
    const phone = document.getElementById("clientPhone").value.trim();
    const email = document.getElementById("clientEmail").value.trim();
    const address = document.getElementById("clientAddress").value.trim();

    if (!name || !phone || !email || !address) {
      msgBox.classList.add("error");
      msgBox.textContent = "Completează toate câmpurile.";
      return false;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      msgBox.classList.add("error");
      msgBox.textContent = "Email invalid.";
      return false;
    }
  }

  return true;
}

// Navigation
btnPrev.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    updateWizardUI();
  }
});

btnNext.addEventListener("click", async () => {
  if (!validateStep(currentStep)) return;

  if (currentStep < 3) {
    currentStep++;
    updateWizardUI();
  } else {
    await submitBooking();
  }
});

// Live summary updates
["clientName", "clientAddress"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", updateWizardUI);
  }
});

document.querySelectorAll('input[name="serviceType"]').forEach((input) =>
  input.addEventListener("change", updateWizardUI)
);

// Date change
bookingDateInput.addEventListener("change", () => {
  loadSlotsForDate(bookingDateInput.value);
});

// Load slots
async function loadSlotsForDate(dateStr) {
  timeSlotSelect.innerHTML = "";
  slotStatus.textContent = "";

  if (!dateStr) {
    timeSlotSelect.innerHTML =
      '<option value="">Selectează o dată mai întâi</option>';
    return;
  }

  // Weekend check
  const d = new Date(dateStr);
  const day = d.getDay();
  if (!(day === 0 || day === 6)) {
    timeSlotSelect.innerHTML = "";
    slotStatus.textContent =
      "Programările sunt disponibile doar în weekend.";
    return;
  }

  timeSlotSelect.innerHTML = '<option value="">Se încarcă...</option>';

  try {
    const res = await fetch(`/api/slots?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();

    const slots = data.slots || [];

    if (!slots.length) {
      timeSlotSelect.innerHTML =
        '<option value="">Nu există intervale disponibile.</option>';
      slotStatus.textContent = "Alege alt weekend.";
      return;
    }

    timeSlotSelect.innerHTML = '<option value="">Alege un interval...</option>';
    slots.forEach((slot) => {
      timeSlotSelect.innerHTML += `<option value="${slot}">${slot}</option>`;
    });

    slotStatus.textContent = `Sunt disponibile ${slots.length} intervale.`;
  } catch (err) {
    console.error(err);
    timeSlotSelect.innerHTML =
      '<option value="">Eroare la încărcarea sloturilor</option>';
  }

  updateWizardUI();
}

// Time slot change
timeSlotSelect.addEventListener("change", updateWizardUI);

// Submit booking
async function submitBooking() {
  msgBox.className = "booking-message";
  msgBox.textContent = "";

  const serviceType = getSelectedService();
  const date = bookingDateInput.value;
  const timeSlot = timeSlotSelect.value;
  const name = document.getElementById("clientName").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const email = document.getElementById("clientEmail").value.trim();
  const address = document.getElementById("clientAddress").value.trim();
  const notes = document.getElementById("clientNotes").value.trim();

  const payload = {
    serviceType,
    date,
    timeSlot,
    name,
    phone,
    email,
    address,
    notes,
  };

  btnNext.disabled = true;
  btnNext.textContent = "Se trimite...";

  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    // Show modal
    document.getElementById("confirmText").textContent =
      `Rezervarea dvs. a fost înregistrată. Veți primi un email de confirmare la adresa ${email}.`;

    document.getElementById("confirmModal").classList.remove("hidden");

    // Reset form
    currentStep = 1;
    document
      .querySelector('input[name="serviceType"]:checked')
      ?.removeAttribute("checked");

    bookingDateInput.value = "";
    timeSlotSelect.innerHTML = '<option value="">Selectează o dată</option>';
    document.getElementById("clientName").value = "";
    document.getElementById("clientPhone").value = "";
    document.getElementById("clientEmail").value = "";
    document.getElementById("clientAddress").value = "";
    document.getElementById("clientNotes").value = "";

    updateWizardUI();
  } catch (err) {
    msgBox.classList.add("error");
    msgBox.textContent = err.message;
  } finally {
    btnNext.disabled = false;
    btnNext.textContent = "Trimite rezervarea";
  }
}

// Close modal
document
  .getElementById("closeModal")
  .addEventListener("click", () => {
    document.getElementById("confirmModal").classList.add("hidden");
  });

// Init
updateWizardUI();
