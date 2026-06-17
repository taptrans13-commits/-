(function () {
  const MAIL_TO = "Head-tp@yandex.ru";
  const products = Array.isArray(window.TP_PRODUCTS) ? window.TP_PRODUCTS : [];
  const groups = Array.isArray(window.TP_GROUPS) ? window.TP_GROUPS : [];
  const categories = window.TP_CATEGORIES || {};
  const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

  const $ = (selector) => document.querySelector(selector);

  function money(value) {
    return rub.format(Math.round(Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function productSpecs(item) {
    const specs = [];
    if (item.marking) specs.push(["Маркировка", item.marking]);
    if (item.powerPerM) specs.push(["Мощность", `${item.powerPerM} Вт/м`]);
    if (item.sectionLength) specs.push(["Длина", `${item.sectionLength} м`]);
    if (item.area) specs.push(["Площадь", `${item.area} м2`]);
    if (item.minOrder) specs.push(["Мин. отгрузка", `${item.minOrder} ${item.unit || "шт."}`]);
    if (item.packQty) specs.push(["Упаковка", `${item.packQty} ${item.unit || "шт."}`]);
    return specs;
  }

  function requestHref(item) {
    const subject = encodeURIComponent(`Заявка: ${item.article}`);
    const body = encodeURIComponent([
      "Здравствуйте!",
      "",
      "Прошу уточнить наличие, срок поставки и итоговую стоимость позиции:",
      `${item.article} - ${item.name}`,
      `Цена с НДС: ${money(item.priceNds)} за ${item.unit || "ед."}`,
      "",
      "Контакты для связи:",
    ].join("\n"));
    return `mailto:${MAIL_TO}?subject=${subject}&body=${body}`;
  }

  function productCard(item) {
    const specs = productSpecs(item)
      .slice(0, 5)
      .map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`)
      .join("");
    return `<article class="product-card">
      <div class="product-card-top">
        <span class="product-article">${escapeHtml(item.article)}</span>
        <span class="product-unit">${escapeHtml(item.unit || "ед.")}</span>
      </div>
      <h3>${escapeHtml(item.name)}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      <div class="product-specs">${specs}</div>
      <div class="product-card-bottom">
        <strong>${money(item.priceNds)}</strong>
        <a class="button secondary" href="${requestHref(item)}">Запросить</a>
      </div>
    </article>`;
  }

  function renderGroupCards() {
    const root = $("#catalogGroupCards");
    if (!root) return;
    root.innerHTML = groups
      .map((group) => {
        const count = products.filter((item) => item.type === group.type).length;
        return `<article class="catalog-group-card">
          <img src="${escapeHtml(group.image)}" alt="">
          <div>
            <span>${count} позиций</span>
            <h3>${escapeHtml(group.name)}</h3>
            <p>${escapeHtml(group.description)}</p>
            <a href="${escapeHtml(group.url)}">Открыть группу</a>
          </div>
        </article>`;
      })
      .join("");
  }

  function fillGroupFilter() {
    const filter = $("#catalogGroupFilter");
    if (!filter) return;
    filter.innerHTML = '<option value="all">Все группы</option>' + groups
      .map((group) => `<option value="${escapeHtml(group.type)}">${escapeHtml(group.name)}</option>`)
      .join("");
  }

  function selectedProducts() {
    const pageType = document.body.dataset.catalogType || "all";
    const query = ($("#catalogSearch")?.value || "").trim().toLowerCase();
    const groupFilter = $("#catalogGroupFilter")?.value || "all";
    return products.filter((item) => {
      const inPage = pageType === "all" || item.type === pageType;
      const inFilter = groupFilter === "all" || item.type === groupFilter;
      const haystack = `${item.article} ${item.name} ${item.marking} ${item.group} ${item.category}`.toLowerCase();
      return inPage && inFilter && (!query || haystack.includes(query));
    });
  }

  function renderCatalog() {
    const root = $("#catalogGrid");
    if (!root) return;

    const rows = selectedProducts();
    const grouped = new Map();
    rows.forEach((item) => {
      const groupKey = item.group;
      if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
      const categoryMap = grouped.get(groupKey);
      if (!categoryMap.has(item.category)) categoryMap.set(item.category, []);
      categoryMap.get(item.category).push(item);
    });

    const count = $("#catalogCount");
    if (count) count.textContent = `${rows.length} ${plural(rows.length, "позиция", "позиции", "позиций")}`;

    root.innerHTML = Array.from(grouped.entries())
      .map(([groupName, categoryMap]) => {
        const group = groups.find((entry) => entry.name === groupName);
        const categoriesHtml = Array.from(categoryMap.entries())
          .map(([categoryName, items]) => {
            const meta = categories[categoryName] || {};
            return `<section class="category-block">
              <div class="category-head">
                <div>
                  <p class="section-kicker">${items.length} ${plural(items.length, "позиция", "позиции", "позиций")}</p>
                  <h3>${escapeHtml(categoryName)}</h3>
                </div>
                <p>${escapeHtml(meta.description || group?.description || "")}</p>
              </div>
              <div class="product-grid">${items.map(productCard).join("")}</div>
            </section>`;
          })
          .join("");
        return `<section class="catalog-group-section">
          <div class="section-head compact">
            <p class="section-kicker">${escapeHtml(groupName)}</p>
            <h2>${escapeHtml(groupName)}</h2>
            <p>${escapeHtml(group?.description || "")}</p>
          </div>
          ${categoriesHtml}
        </section>`;
      })
      .join("") || '<p class="empty-state">По выбранным условиям товары не найдены.</p>';
  }

  function plural(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function bindEvents() {
    $("#catalogSearch")?.addEventListener("input", renderCatalog);
    $("#catalogGroupFilter")?.addEventListener("input", renderCatalog);
  }

  function init() {
    renderGroupCards();
    fillGroupFilter();
    bindEvents();
    renderCatalog();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
