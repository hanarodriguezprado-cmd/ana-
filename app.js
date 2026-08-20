const STORAGE_KEY = "misGastos.expenses.v1";

const CATEGORIES = [
  { id: "comida", label: "Comida", icon: "🍔" },
  { id: "transporte", label: "Transporte", icon: "🚌" },
  { id: "ocio", label: "Ocio", icon: "🎉" },
  { id: "salud", label: "Salud", icon: "💊" },
  { id: "hogar", label: "Hogar", icon: "🏠" },
  { id: "otros", label: "Otros", icon: "💳" },
];

const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const state = {
  expenses: loadExpenses(),
  categoryFilter: "all",
  periodFilter: "month",
};

const els = {
  monthTotal: document.getElementById("monthTotal"),
  breakdown: document.getElementById("breakdown"),
  categoryChips: document.getElementById("categoryChips"),
  periodFilter: document.getElementById("periodFilter"),
  expenseList: document.getElementById("expenseList"),
  emptyState: document.getElementById("emptyState"),
  addBtn: document.getElementById("addBtn"),
  modalOverlay: document.getElementById("modalOverlay"),
  expenseForm: document.getElementById("expenseForm"),
  amountInput: document.getElementById("amountInput"),
  categoryInput: document.getElementById("categoryInput"),
  dateInput: document.getElementById("dateInput"),
  noteInput: document.getElementById("noteInput"),
  cancelBtn: document.getElementById("cancelBtn"),
};

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
}

function formatCurrency(amount) {
  return amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

function formatDate(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function isSameMonth(isoDate, ref) {
  return isoDate.slice(0, 7) === ref.slice(0, 7);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function renderCategoryChips() {
  const chips = [{ id: "all", label: "Todas", icon: "" }, ...CATEGORIES];
  els.categoryChips.innerHTML = "";
  chips.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (state.categoryFilter === c.id ? " active" : "");
    btn.textContent = c.icon ? `${c.icon} ${c.label}` : c.label;
    btn.addEventListener("click", () => {
      state.categoryFilter = c.id;
      render();
    });
    els.categoryChips.appendChild(btn);
  });
}

function getFilteredExpenses() {
  const today = todayIso();
  return state.expenses
    .filter((e) => state.periodFilter !== "month" || isSameMonth(e.date, today))
    .filter((e) => state.categoryFilter === "all" || e.category === state.categoryFilter)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

function renderSummary() {
  const today = todayIso();
  const monthExpenses = state.expenses.filter((e) => isSameMonth(e.date, today));
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  els.monthTotal.textContent = formatCurrency(total);

  const totalsByCategory = {};
  monthExpenses.forEach((e) => {
    totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + e.amount;
  });

  els.breakdown.innerHTML = "";
  const entries = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return;
  }

  entries.forEach(([catId, amount]) => {
    const cat = categoryById[catId];
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `
      <span>${cat.icon} ${cat.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="amount">${formatCurrency(amount)}</span>
    `;
    els.breakdown.appendChild(row);
  });
}

function renderList() {
  const filtered = getFilteredExpenses();
  els.expenseList.innerHTML = "";

  if (filtered.length === 0) {
    els.emptyState.style.display = "block";
    return;
  }
  els.emptyState.style.display = "none";

  filtered.forEach((e) => {
    const cat = categoryById[e.category] || CATEGORIES[CATEGORIES.length - 1];
    const li = document.createElement("li");
    li.className = "expense-item";
    li.innerHTML = `
      <span class="expense-icon">${cat.icon}</span>
      <span class="expense-info">
        <div class="expense-category">${cat.label}</div>
        <div class="expense-meta">${formatDate(e.date)}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
      </span>
      <span class="expense-amount">${formatCurrency(e.amount)}</span>
      <button class="delete-btn" aria-label="Borrar" data-id="${e.id}">✕</button>
    `;
    els.expenseList.appendChild(li);
  });

  els.expenseList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.expenses = state.expenses.filter((e) => e.id !== btn.dataset.id);
      saveExpenses();
      render();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderCategoryChips();
  renderSummary();
  renderList();
}

function openModal() {
  els.dateInput.value = todayIso();
  els.amountInput.value = "";
  els.noteInput.value = "";
  els.modalOverlay.classList.remove("hidden");
  els.amountInput.focus();
}

function closeModal() {
  els.modalOverlay.classList.add("hidden");
}

function populateCategorySelect() {
  els.categoryInput.innerHTML = CATEGORIES
    .map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`)
    .join("");
}

els.addBtn.addEventListener("click", openModal);
els.cancelBtn.addEventListener("click", closeModal);
els.modalOverlay.addEventListener("click", (ev) => {
  if (ev.target === els.modalOverlay) closeModal();
});
els.periodFilter.addEventListener("change", () => {
  state.periodFilter = els.periodFilter.value;
  render();
});

els.expenseForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const amount = parseFloat(els.amountInput.value);
  if (!amount || amount <= 0) return;

  state.expenses.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    amount,
    category: els.categoryInput.value,
    date: els.dateInput.value || todayIso(),
    note: els.noteInput.value.trim(),
    createdAt: Date.now(),
  });

  saveExpenses();
  closeModal();
  render();
});

populateCategorySelect();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
