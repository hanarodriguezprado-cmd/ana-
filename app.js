const STORAGE_KEY = "misGastos.expenses.v1";

const CATEGORIES = [
  { id: "comida", label: "Comida", icon: "🍔" },
  { id: "transporte", label: "Transporte", icon: "🚌" },
  { id: "ocio", label: "Ocio", icon: "🎉" },
  { id: "salud", label: "Salud", icon: "💊" },
  { id: "hogar", label: "Hogar", icon: "🏠" },
  { id: "vinted", label: "Vinted", icon: "👕" },
  { id: "otros", label: "Otros", icon: "💳" },
];

const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const state = {
  expenses: loadExpenses(),
  view: "general",
  categoryFilter: "all",
  periodFilter: "month",
};

let currentType = "gasto";

const els = {
  viewTabs: document.getElementById("viewTabs"),
  summaryLabel: document.getElementById("summaryLabel"),
  incomeLabel: document.getElementById("incomeLabel"),
  monthTotal: document.getElementById("monthTotal"),
  monthIncome: document.getElementById("monthIncome"),
  monthBalance: document.getElementById("monthBalance"),
  breakdown: document.getElementById("breakdown"),
  filters: document.querySelector(".filters"),
  categoryChips: document.getElementById("categoryChips"),
  periodFilter: document.getElementById("periodFilter"),
  expenseList: document.getElementById("expenseList"),
  emptyState: document.getElementById("emptyState"),
  addBtn: document.getElementById("addBtn"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  expenseForm: document.getElementById("expenseForm"),
  typeToggle: document.getElementById("typeToggle"),
  amountInput: document.getElementById("amountInput"),
  categoryLabel: document.getElementById("categoryLabel"),
  categoryInput: document.getElementById("categoryInput"),
  dateInput: document.getElementById("dateInput"),
  noteInput: document.getElementById("noteInput"),
  cancelBtn: document.getElementById("cancelBtn"),
};

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map((e) => ({ type: "gasto", ...e }));
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

function inPeriod(expense, today) {
  return state.periodFilter !== "month" || isSameMonth(expense.date, today);
}

function scopedExpenses() {
  const today = todayIso();
  return state.expenses
    .filter((e) => inPeriod(e, today))
    .filter((e) => state.view !== "vinted" || e.category === "vinted");
}

function renderTabs() {
  els.viewTabs.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.view);
  });
  els.filters.style.display = state.view === "vinted" ? "none" : "flex";
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
  return scopedExpenses()
    .filter((e) => state.view === "vinted" || state.categoryFilter === "all" || e.category === state.categoryFilter)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

function renderSummary() {
  const items = scopedExpenses();
  const gasto = items.filter((e) => e.type === "gasto").reduce((sum, e) => sum + e.amount, 0);
  const ingreso = items.filter((e) => e.type === "ingreso").reduce((sum, e) => sum + e.amount, 0);
  const balance = ingreso - gasto;

  els.summaryLabel.textContent = state.view === "vinted" ? "Gastado en Vinted" : "Gastado este mes";
  els.incomeLabel.textContent = state.view === "vinted" ? "Ganado en Vinted" : "Ingresado";
  els.monthTotal.textContent = formatCurrency(gasto);
  els.monthIncome.textContent = formatCurrency(ingreso);
  const balanceSign = balance > 0 ? "+" : balance < 0 ? "-" : "";
  els.monthBalance.textContent = balanceSign + formatCurrency(Math.abs(balance));
  els.monthBalance.style.color = balance >= 0 ? "var(--accent)" : "var(--danger)";

  els.breakdown.innerHTML = "";

  if (state.view === "vinted") {
    const rows = [
      { label: "🛒 Comprado", amount: gasto },
      { label: "💰 Vendido", amount: ingreso },
    ];
    const max = Math.max(gasto, ingreso, 1);
    rows.forEach((r) => {
      if (r.amount === 0) return;
      const pct = Math.round((r.amount / max) * 100);
      els.breakdown.appendChild(buildBreakdownRow(r.label, pct, r.amount));
    });
    return;
  }

  const totalsByCategory = {};
  items.filter((e) => e.type === "gasto").forEach((e) => {
    totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + e.amount;
  });

  const entries = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);
  entries.forEach(([catId, amount]) => {
    const cat = categoryById[catId];
    const pct = gasto > 0 ? Math.round((amount / gasto) * 100) : 0;
    els.breakdown.appendChild(buildBreakdownRow(`${cat.icon} ${cat.label}`, pct, amount));
  });
}

function buildBreakdownRow(label, pct, amount) {
  const row = document.createElement("div");
  row.className = "breakdown-row";
  row.innerHTML = `
    <span>${label}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
    <span class="amount">${formatCurrency(amount)}</span>
  `;
  return row;
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
    const isIncome = e.type === "ingreso";
    const li = document.createElement("li");
    li.className = "expense-item";
    li.innerHTML = `
      <span class="expense-icon">${cat.icon}</span>
      <span class="expense-info">
        <div class="expense-category">${cat.label}</div>
        <div class="expense-meta">${formatDate(e.date)}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
      </span>
      <span class="expense-amount${isIncome ? " income" : ""}">${isIncome ? "+" : "-"}${formatCurrency(e.amount)}</span>
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
  renderTabs();
  renderCategoryChips();
  renderSummary();
  renderList();
}

function setType(type) {
  currentType = type;
  els.typeToggle.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function openModal() {
  const forcedCategory = state.view === "vinted" ? "vinted" : null;
  els.dateInput.value = todayIso();
  els.amountInput.value = "";
  els.noteInput.value = "";
  setType("gasto");

  if (forcedCategory) {
    els.categoryLabel.style.display = "none";
    els.categoryInput.value = forcedCategory;
    els.modalTitle.textContent = "Nuevo movimiento Vinted";
  } else {
    els.categoryLabel.style.display = "flex";
    els.categoryInput.value = "comida";
    els.modalTitle.textContent = "Nuevo movimiento";
  }

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

els.viewTabs.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab");
  if (!btn) return;
  state.view = btn.dataset.view;
  state.categoryFilter = "all";
  render();
});

els.typeToggle.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".seg-btn");
  if (!btn) return;
  setType(btn.dataset.type);
});

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

  const category = state.view === "vinted" ? "vinted" : els.categoryInput.value;

  state.expenses.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    amount,
    type: currentType,
    category,
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
