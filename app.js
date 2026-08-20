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
  vintedHistory: document.getElementById("vintedHistory"),
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
  noteLabel: document.getElementById("noteLabel"),
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

function vintedExpenses() {
  return state.expenses.filter((e) => e.category === "vinted");
}

function scopedExpenses() {
  if (state.view === "vinted") return vintedExpenses();
  const today = todayIso();
  return state.expenses.filter((e) => inPeriod(e, today));
}

function monthLabel(monthKey) {
  const d = new Date(monthKey + "-01T00:00:00");
  const label = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
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

function buildItemRow(e, { primaryLabel, icon }) {
  const isIncome = e.type === "ingreso";
  const li = document.createElement("li");
  li.className = "expense-item";
  li.innerHTML = `
    <span class="expense-icon">${icon}</span>
    <span class="expense-info">
      <div class="expense-category">${escapeHtml(primaryLabel)}</div>
      <div class="expense-meta">${formatDate(e.date)}</div>
    </span>
    <span class="expense-amount${isIncome ? " income" : ""}">${isIncome ? "+" : "-"}${formatCurrency(e.amount)}</span>
    <button class="delete-btn" aria-label="Borrar" data-id="${e.id}">✕</button>
  `;
  return li;
}

function wireDeleteButtons(container) {
  container.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.expenses = state.expenses.filter((e) => e.id !== btn.dataset.id);
      saveExpenses();
      render();
    });
  });
}

function renderList() {
  els.expenseList.style.display = "flex";
  els.vintedHistory.style.display = "none";

  const filtered = getFilteredExpenses();
  els.expenseList.innerHTML = "";

  if (filtered.length === 0) {
    els.emptyState.style.display = "block";
    return;
  }
  els.emptyState.style.display = "none";

  filtered.forEach((e) => {
    const cat = categoryById[e.category] || CATEGORIES[CATEGORIES.length - 1];
    const label = cat.label + (e.note ? " · " + e.note : "");
    els.expenseList.appendChild(buildItemRow(e, { primaryLabel: label, icon: cat.icon }));
  });

  wireDeleteButtons(els.expenseList);
}

function renderVintedHistory() {
  els.expenseList.style.display = "none";
  els.vintedHistory.style.display = "flex";

  const items = vintedExpenses();
  els.vintedHistory.innerHTML = "";

  if (items.length === 0) {
    els.emptyState.style.display = "block";
    return;
  }
  els.emptyState.style.display = "none";

  const byMonth = {};
  items.forEach((e) => {
    const key = e.date.slice(0, 7);
    (byMonth[key] = byMonth[key] || []).push(e);
  });

  Object.keys(byMonth)
    .sort((a, b) => (a < b ? 1 : -1))
    .forEach((monthKey) => {
      const monthItems = byMonth[monthKey].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt
      );
      const gasto = monthItems.filter((e) => e.type === "gasto").reduce((s, e) => s + e.amount, 0);
      const ingreso = monthItems.filter((e) => e.type === "ingreso").reduce((s, e) => s + e.amount, 0);
      const balance = ingreso - gasto;
      const sign = balance > 0 ? "+" : balance < 0 ? "-" : "";

      const group = document.createElement("div");
      group.className = "month-group";

      const header = document.createElement("div");
      header.className = "month-group-header";
      header.innerHTML = `
        <span class="month-group-title">${monthLabel(monthKey)}</span>
        <span class="month-group-balance" style="color:${balance >= 0 ? "var(--accent)" : "var(--danger)"}">
          ${sign}${formatCurrency(Math.abs(balance))}
        </span>
      `;
      group.appendChild(header);

      const list = document.createElement("ul");
      list.className = "month-group-list";
      monthItems.forEach((e) => {
        const isIncome = e.type === "ingreso";
        const label = (e.note || "Sin nombre") + (isIncome ? " · Venta" : " · Compra");
        list.appendChild(buildItemRow(e, { primaryLabel: label, icon: isIncome ? "💰" : "🛒" }));
      });
      group.appendChild(list);

      els.vintedHistory.appendChild(group);
    });

  wireDeleteButtons(els.vintedHistory);
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
  if (state.view === "vinted") {
    renderVintedHistory();
  } else {
    renderList();
  }
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
    els.noteLabel.firstChild.textContent = "Prenda";
    els.noteInput.placeholder = "Ej. Sudadera Nike";
    els.noteInput.required = true;
  } else {
    els.categoryLabel.style.display = "flex";
    els.categoryInput.value = "comida";
    els.modalTitle.textContent = "Nuevo movimiento";
    els.noteLabel.firstChild.textContent = "Nota (opcional)";
    els.noteInput.placeholder = "Ej. Cena con amigos";
    els.noteInput.required = false;
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
