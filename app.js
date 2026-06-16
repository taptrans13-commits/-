(function () {
  const MAIL_TO = "Head-tp@yandex.ru";
  const PHONE = "+73422077888";
  const products = Array.isArray(window.TP_PRODUCTS) ? window.TP_PRODUCTS : [];
  const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
  const numberFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  const state = {
    mode: "floor",
    priceLimit: 18,
    requestLines: [],
    lastCalcLines: [],
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const floorSections = products
    .filter((item) => item.type === "floor" && item.unit.startsWith("шт") && item.sectionLength && item.powerPerM)
    .filter((item) => /кабель/i.test(item.name))
    .sort((a, b) => a.sectionLength - b.sectionLength);

  const roofSections = products
    .filter((item) => item.type === "architecture" && item.unit.startsWith("шт") && item.sectionLength && item.powerPerM === 30)
    .sort((a, b) => a.sectionLength - b.sectionLength);

  const pipeCables = products
    .filter((item) => item.unit.startsWith("м") && item.powerPerM && /кабель/i.test(item.name))
    .sort((a, b) => a.priceNds - b.priceNds);

  function money(value) {
    return rub.format(Math.round(Number(value) || 0));
  }

  function fmt(value, unit) {
    return `${numberFmt.format(Number(value) || 0)} ${unit}`;
  }

  function optionName(item) {
    const specs = [];
    if (item.powerPerM) specs.push(`${numberFmt.format(item.powerPerM)} Вт/м`);
    if (item.sectionLength) specs.push(`${numberFmt.format(item.sectionLength)} м`);
    return `${item.article} - ${item.name}${specs.length ? ` (${specs.join(", ")})` : ""}`;
  }

  function compactName(item) {
    const len = item.sectionLength ? `, ${numberFmt.format(item.sectionLength)} м` : "";
    const power = item.powerPerM ? `, ${numberFmt.format(item.powerPerM)} Вт/м` : "";
    return `${item.article}: ${item.name}${power}${len}`;
  }

  function setMode(mode) {
    state.mode = mode;
    $$(".segment").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    ["floor", "roof", "pipe"].forEach((name) => {
      $$(`.${name}-only`).forEach((node) => node.classList.toggle("hidden", name !== mode));
    });
    calculateVolume();
  }

  function chooseSections(pool, requiredLength, power) {
    const filtered = pool.filter((item) => !power || item.powerPerM === Number(power));
    if (!filtered.length || requiredLength <= 0) return { lines: [], cost: 0, installedLength: 0 };

    const sorted = filtered.slice().sort((a, b) => a.sectionLength - b.sectionLength);
    const max = sorted[sorted.length - 1];
    const picks = new Map();
    let remaining = requiredLength;

    while (remaining > max.sectionLength * 1.25) {
      picks.set(max.article, { item: max, qty: (picks.get(max.article)?.qty || 0) + 1 });
      remaining -= max.sectionLength;
    }

    const nearest = sorted.find((item) => item.sectionLength >= remaining) || max;
    picks.set(nearest.article, { item: nearest, qty: (picks.get(nearest.article)?.qty || 0) + 1 });

    const lines = Array.from(picks.values()).map(({ item, qty }) => ({
      item,
      qty,
      length: item.sectionLength * qty,
      price: item.priceNds * qty,
    }));
    return {
      lines,
      cost: lines.reduce((sum, row) => sum + row.price, 0),
      installedLength: lines.reduce((sum, row) => sum + row.length, 0),
    };
  }

  function getNumber(id, fallback) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function calculateVolume() {
    const reserve = Math.max(0, getNumber("#reserve", 0)) / 100;
    let result;

    if (state.mode === "floor") {
      const area = getNumber("#floorArea", 1);
      const load = getNumber("#floorLoad", 150);
      const power = Number($("#floorPower").value);
      const baseLength = (area * load) / power;
      const requiredLength = Math.ceil(baseLength * (1 + reserve));
      const chosen = chooseSections(floorSections, requiredLength, power);
      result = {
        title: `Теплый пол: ${fmt(area, "м2")}, ${load} Вт/м2, кабель ${power} Вт/м`,
        volume: chosen.installedLength || requiredLength,
        volumeLabel: `${fmt(requiredLength, "м")} нужно / ${fmt(chosen.installedLength, "м")} в комплектах`,
        powerLabel: fmt((chosen.installedLength || requiredLength) * power, "Вт"),
        itemsLabel: chosen.lines.reduce((sum, row) => sum + row.qty, 0) ? `${chosen.lines.reduce((sum, row) => sum + row.qty, 0)} шт.` : "-",
        cost: chosen.cost,
        lines: chosen.lines.map((row) => `${row.qty} шт. - ${compactName(row.item)} - ${money(row.price)}`),
      };
    }

    if (state.mode === "roof") {
      const length = getNumber("#roofLength", 1);
      const lines = Math.max(1, Math.round(getNumber("#roofLines", 1)));
      const requiredLength = Math.ceil(length * lines * (1 + reserve));
      const chosen = chooseSections(roofSections, requiredLength, 30);
      result = {
        title: `Кровля и водостоки: трасса ${fmt(length, "м")}, ${lines} линии`,
        volume: chosen.installedLength || requiredLength,
        volumeLabel: `${fmt(requiredLength, "м")} нужно / ${fmt(chosen.installedLength, "м")} в комплектах`,
        powerLabel: fmt((chosen.installedLength || requiredLength) * 30, "Вт"),
        itemsLabel: chosen.lines.reduce((sum, row) => sum + row.qty, 0) ? `${chosen.lines.reduce((sum, row) => sum + row.qty, 0)} шт.` : "-",
        cost: chosen.cost,
        lines: chosen.lines.map((row) => `${row.qty} шт. - ${compactName(row.item)} - ${money(row.price)}`),
      };
    }

    if (state.mode === "pipe") {
      const length = getNumber("#pipeLength", 1);
      const lines = Math.max(1, Math.round(getNumber("#pipeLines", 1)));
      const cable = pipeCables.find((item) => item.article === $("#pipeProduct").value) || pipeCables[0];
      const requiredLength = Math.ceil(length * lines * (1 + reserve));
      const cost = cable ? requiredLength * cable.priceNds : 0;
      result = {
        title: `Трубопровод: ${fmt(length, "м")}, ${lines} линии`,
        volume: requiredLength,
        volumeLabel: fmt(requiredLength, "м"),
        powerLabel: cable ? `${fmt(cable.powerPerM, "Вт/м")} / ${fmt(requiredLength * cable.powerPerM, "Вт")}` : "-",
        itemsLabel: cable ? `${requiredLength} м` : "-",
        cost,
        lines: cable ? [`${requiredLength} м - ${compactName(cable)} - ${money(cost)}`] : [],
      };
    }

    state.lastCalcLines = [result.title, `Объем: ${result.volumeLabel}`, `Ориентир: ${money(result.cost)}`, ...result.lines];
    $("#resultTotal").textContent = money(result.cost);
    $("#resultVolume").textContent = result.volumeLabel;
    $("#resultItems").textContent = result.itemsLabel;
    $("#resultPower").textContent = result.powerLabel;
    $("#resultList").innerHTML = result.lines.length
      ? result.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")
      : "<li>Нет подходящей позиции в прайсе.</li>";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillProductSelectors() {
    const pipeSelect = $("#pipeProduct");
    pipeSelect.innerHTML = pipeCables
      .slice(0, 90)
      .map((item) => `<option value="${item.article}">${escapeHtml(optionName(item))} - ${money(item.priceNds)}/м</option>`)
      .join("");

    const productSelect = $("#productSelect");
    productSelect.innerHTML = products
      .map((item) => `<option value="${item.article}">${escapeHtml(optionName(item))} - ${money(item.priceNds)}</option>`)
      .join("");
  }

  function calculateProductQty() {
    const article = $("#productSelect").value;
    const qty = Math.max(1, Math.round(getNumber("#productQty", 1)));
    const item = products.find((product) => product.article === article);
    const sum = item ? item.priceNds * qty : 0;
    $("#quantityTotal").textContent = money(sum);
    return { item, qty, sum };
  }

  function addRequestLine(lines) {
    state.requestLines.push(lines.join("\n"));
    renderRequestSummary();
  }

  function renderRequestSummary() {
    $("#requestSummary").textContent = state.requestLines.length
      ? state.requestLines.map((block, index) => `${index + 1}. ${block}`).join("\n\n")
      : "Расчет и позиции пока не добавлены.";
  }

  function addCalcToRequest() {
    if (state.lastCalcLines.length) addRequestLine(state.lastCalcLines);
  }

  function addProductToRequest() {
    const { item, qty, sum } = calculateProductQty();
    if (!item) return;
    addRequestLine([`Позиция по количеству: ${qty} ${item.unit}`, compactName(item), `Сумма с НДС: ${money(sum)}`]);
  }

  function fillFilters() {
    const groups = Array.from(new Set(products.map((item) => item.group))).sort((a, b) => a.localeCompare(b, "ru"));
    $("#groupFilter").innerHTML += groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join("");
  }

  function filteredPrices() {
    const query = $("#priceSearch").value.trim().toLowerCase();
    const group = $("#groupFilter").value;
    return products.filter((item) => {
      const matchesGroup = group === "all" || item.group === group;
      const haystack = `${item.article} ${item.name} ${item.group} ${item.category}`.toLowerCase();
      return matchesGroup && (!query || haystack.includes(query));
    });
  }

  function renderPrices(resetLimit) {
    if (resetLimit) state.priceLimit = 18;
    const rows = filteredPrices();
    const visible = rows.slice(0, state.priceLimit);
    $("#priceBody").innerHTML = visible
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.article)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.group)}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td>${money(item.priceNds)}</td>
        </tr>`,
      )
      .join("");
    $("#priceCount").textContent = `${rows.length} ${plural(rows.length, "позиция", "позиции", "позиций")}`;
    $("#showMore").hidden = rows.length <= state.priceLimit;
  }

  function plural(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function makeMailBody(reason) {
    const name = $("#clientName").value.trim();
    const phone = $("#clientPhone").value.trim();
    const email = $("#clientEmail").value.trim();
    const comment = $("#clientComment").value.trim();
    return [
      reason || "Заявка с сайта ТЕХНОПРОГРЕСС",
      "",
      `Имя: ${name || "-"}`,
      `Телефон: ${phone || "-"}`,
      `Email: ${email || "-"}`,
      "",
      "Комментарий:",
      comment || "-",
      "",
      "Расчет / позиции:",
      state.requestLines.length ? state.requestLines.join("\n\n") : "-",
    ].join("\n");
  }

  function submitRequest(event) {
    event.preventDefault();
    const form = $("#requestForm");
    if (!form.reportValidity()) return;
    const subject = encodeURIComponent("Заявка с сайта ТЕХНОПРОГРЕСС");
    const body = encodeURIComponent(makeMailBody());
    window.location.href = `mailto:${MAIL_TO}?subject=${subject}&body=${body}`;
  }

  function callbackRequest() {
    $("#clientComment").value = $("#clientComment").value.trim() || "Прошу перезвонить и уточнить расчет.";
    $("#request").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#clientPhone").focus(), 350);
  }

  function bindEvents() {
    $$(".segment").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
    $$("[data-mode-link]").forEach((link) => link.addEventListener("click", () => setMode(link.dataset.modeLink)));
    $$("#volumeForm input, #volumeForm select").forEach((input) => input.addEventListener("input", calculateVolume));
    $("#addCalcToRequest").addEventListener("click", addCalcToRequest);
    $("#productSelect").addEventListener("input", calculateProductQty);
    $("#productQty").addEventListener("input", calculateProductQty);
    $("#addProductToRequest").addEventListener("click", addProductToRequest);
    $("#priceSearch").addEventListener("input", () => renderPrices(true));
    $("#groupFilter").addEventListener("input", () => renderPrices(true));
    $("#showMore").addEventListener("click", () => {
      state.priceLimit += 18;
      renderPrices(false);
    });
    $("#requestForm").addEventListener("submit", submitRequest);
    $$("[data-callback]").forEach((button) => button.addEventListener("click", callbackRequest));
  }

  function init() {
    fillProductSelectors();
    fillFilters();
    bindEvents();
    calculateVolume();
    calculateProductQty();
    renderPrices(true);
    renderRequestSummary();

    if (!products.length) {
      $("#priceBody").innerHTML = "<tr><td colspan=\"5\">Прайс временно недоступен.</td></tr>";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  window.TP_SITE = { setMode };
})();
