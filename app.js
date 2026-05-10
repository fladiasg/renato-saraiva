const SHEET_ID = "1mMetboyVVyBDyGCtYAPOvQQHkt10NJ6QKMOeJy0isiU";
const SHEET_NAME = "RAW_Meta_Trafego";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

const views = {
  ig: {
    title: "Distribuição de Conteúdo",
    filter: "IG",
    filterLabel: "Campaign Name contém IG",
    description: "Leitura de alcance, visitas, engajamento e retenção dos criativos de distribuição.",
    rankingSort: "engagement",
    rankingHint: "Ordenado por engajamentos",
    cards: "distribution",
  },
  clube: {
    title: "Funil de Leads - Clube",
    filter: "CLUBE",
    filterLabel: "Campaign Name contém CLUBE",
    description: "Funil de clique, chegada na landing page e conversão em lead para o Clube.",
    rankingSort: "leads",
    rankingHint: "Ordenado por leads",
    cards: "club",
  },
  live: {
    title: "Live 12/05 - Grupo WhatsApp",
    filter: "LIVE",
    filterLabel: "Campaign Name contém LIVE",
    description: "Campanhas da live com foco em clique, intenção de entrada no WhatsApp e custo por ação.",
    rankingSort: "outbound",
    rankingHint: "Ordenado por cliques para WhatsApp",
    cards: "live",
  },
};

let rows = [];
let currentView = "ig";

const els = {
  status: document.querySelector("#status"),
  period: document.querySelector("#period"),
  tabs: document.querySelectorAll(".tab"),
  viewFilter: document.querySelector("#viewFilter"),
  viewTitle: document.querySelector("#viewTitle"),
  viewDescription: document.querySelector("#viewDescription"),
  heroSpend: document.querySelector("#heroSpend"),
  cards: document.querySelector("#cards"),
  rankingHint: document.querySelector("#rankingHint"),
  rankingHeader: document.querySelector("#rankingHeader"),
  rankingRows: document.querySelector("#rankingRows"),
  insights: document.querySelector("#insights"),
};

function parseCsv(text) {
  const out = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (cell || row.length) {
        row.push(cell);
        out.push(row);
        row = [];
        cell = "";
      }
      if (char === "\r" && next === "\n") i += 1;
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }

  return out;
}

function normalizeRows(csv) {
  const [header, ...data] = parseCsv(csv);
  return data
    .map((line) => Object.fromEntries(header.map((key, index) => [key, line[index] ?? ""])))
    .filter((row) => row.Day && row["Campaign Name"]);
}

function number(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return new Date(`${raw.slice(0, 10)}T00:00:00`);
  }

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return new Date(Number(year), Number(m) - 1, Number(d));
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value, digits = 0) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPercent(value) {
  return value.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 2 });
}

function filteredRows() {
  const view = views[currentView];
  const days = Number(els.period.value);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);

  return rows.filter((row) => {
    const day = parseDate(row.Day);
    const campaign = String(row["Campaign Name"]).toUpperCase();
    return day && day >= start && campaign.includes(view.filter);
  });
}

function sum(data, key) {
  return data.reduce((total, row) => total + number(row[key]), 0);
}

function metrics(data) {
  const spend = sum(data, "Amount Spent");
  const impressions = sum(data, "Impressions");
  const reach = sum(data, "Reach");
  const clicks = sum(data, "Clicks (All)");
  const linkClicks = sum(data, "Inline Link Clicks in Ad");
  const outbound = sum(data, "Outbound Clicks");
  const lpViews = sum(data, "Landing Page Views");
  const contentViews = sum(data, "Website Content Views");
  const leads = sum(data, "Leads");
  const engagement = sum(data, "Inline Post Engagement in Ad");
  const saves = sum(data, "Post Saves");
  const thruplays = sum(data, "ThruPlays");
  const video3s = sum(data, "3-Second Video Views");
  const video50 = sum(data, "Video Watches at 50%");

  return {
    spend,
    impressions,
    reach,
    clicks,
    linkClicks,
    outbound,
    lpViews,
    contentViews,
    leads,
    engagement,
    saves,
    thruplays,
    frequency: reach ? impressions / reach : 0,
    ctr: impressions ? linkClicks / impressions : 0,
    cpc: linkClicks ? spend / linkClicks : 0,
    cplp: lpViews ? spend / lpViews : 0,
    cpLead: leads ? spend / leads : 0,
    linkToLp: linkClicks ? lpViews / linkClicks : 0,
    outboundToLp: outbound ? lpViews / outbound : 0,
    lpToLead: lpViews ? leads / lpViews : 0,
    engagementRate: impressions ? engagement / impressions : 0,
    costEngagement: engagement ? spend / engagement : 0,
    retention50: video3s ? video50 / video3s : 0,
  };
}

function card(label, value, note) {
  return `<article class="card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function renderCards(m) {
  const blocks = {
    distribution: [
      card("Gasto", formatCurrency(m.spend), "Verba usada em campanhas IG"),
      card("Alcance", formatNumber(m.reach), "Pessoas alcançadas"),
      card("Visitas", formatNumber(m.lpViews), "Landing Page Views"),
      card("Custo por visita", formatCurrency(m.cplp), "Gasto / LP views"),
      card("Inline Link Clicks", formatNumber(m.linkClicks), "Cliques no link"),
      card("CTR Link", formatPercent(m.ctr), "Link clicks / impressões"),
      card("Engajamentos", formatNumber(m.engagement), "Inline post engagement"),
      card("Taxa de engajamento", formatPercent(m.engagementRate), "Engajamentos / impressões"),
      card("Post Saves", formatNumber(m.saves), "Sinal de intenção"),
      card("Retenção 50%", formatPercent(m.retention50), "Views 50% / views 3s"),
      card("Seguidores", "Sem coluna", "Adicionar follows no Adveronix"),
      card("Content Views", formatNumber(m.contentViews), "Website Content Views"),
    ],
    club: [
      card("Gasto", formatCurrency(m.spend), "Verba usada no Clube"),
      card("Impressões", formatNumber(m.impressions), "Volume de entrega"),
      card("Link Clicks", formatNumber(m.linkClicks), "Cliques no anúncio"),
      card("Landing Page Views", formatNumber(m.lpViews), "Chegadas na LP"),
      card("Leads", formatNumber(m.leads), "Conversões da landing page"),
      card("Custo por Lead", formatCurrency(m.cpLead), "Gasto / leads"),
      card("CTR Link", formatPercent(m.ctr), "Link clicks / impressões"),
      card("CPC Link", formatCurrency(m.cpc), "Gasto / link clicks"),
      card("Taxa Link -> LP", formatPercent(m.linkToLp), "LP views / link clicks"),
      card("Taxa LP -> Lead", formatPercent(m.lpToLead), "Leads / LP views"),
      card("Engajamentos", formatNumber(m.engagement), "Resposta ao criativo"),
      card("Retenção 50%", formatPercent(m.retention50), "Views 50% / views 3s"),
    ],
    live: [
      card("Gasto", formatCurrency(m.spend), "Verba usada na live"),
      card("Impressões", formatNumber(m.impressions), "Volume de entrega"),
      card("Clicks (All)", formatNumber(m.clicks), "Todos os cliques"),
      card("Link Clicks", formatNumber(m.linkClicks), "Cliques no botão"),
      card("Outbound Clicks", formatNumber(m.outbound), "Intenção de WhatsApp"),
      card("Custo por WhatsApp", formatCurrency(m.outbound ? m.spend / m.outbound : 0), "Gasto / outbound clicks"),
      card("CTR Link", formatPercent(m.ctr), "Link clicks / impressões"),
      card("CPC Link", formatCurrency(m.cpc), "Gasto / link clicks"),
      card("LP Views", formatNumber(m.lpViews), "Chegadas na página"),
      card("Taxa Link -> WhatsApp", formatPercent(m.linkClicks ? m.outbound / m.linkClicks : 0), "Outbound / link clicks"),
      card("Engajamentos", formatNumber(m.engagement), "Resposta ao criativo"),
      card("Retenção 50%", formatPercent(m.retention50), "Views 50% / views 3s"),
    ],
  };

  els.cards.innerHTML = blocks[views[currentView].cards].join("");
}

function groupedCreatives(data) {
  const groups = new Map();

  for (const row of data) {
    const name = row["Ad Name"] || "Sem nome";
    const item =
      groups.get(name) ||
      {
        name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        linkClicks: 0,
        outbound: 0,
        lpViews: 0,
        leads: 0,
        engagement: 0,
        saves: 0,
      };

    item.spend += number(row["Amount Spent"]);
    item.impressions += number(row.Impressions);
    item.clicks += number(row["Clicks (All)"]);
    item.linkClicks += number(row["Inline Link Clicks in Ad"]);
    item.outbound += number(row["Outbound Clicks"]);
    item.lpViews += number(row["Landing Page Views"]);
    item.leads += number(row.Leads);
    item.engagement += number(row["Inline Post Engagement in Ad"]);
    item.saves += number(row["Post Saves"]);
    groups.set(name, item);
  }

  const sortKey = views[currentView].rankingSort;
  return [...groups.values()].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 10);
}

function renderRanking(data) {
  const rows = groupedCreatives(data);
  const headers =
    currentView === "clube"
      ? ["Criativo", "Gasto", "Impressões", "Link Clicks", "LP Views", "Leads", "CPL", "Engaj."]
      : currentView === "live"
        ? ["Criativo", "Gasto", "Impressões", "Clicks", "Link Clicks", "WhatsApp", "Custo", "Engaj."]
        : ["Criativo", "Gasto", "Impressões", "Link Clicks", "LP Views", "Engaj.", "Saves", "CTR"];

  els.rankingHeader.innerHTML = headers.map((item) => `<th>${item}</th>`).join("");

  if (!rows.length) {
    els.rankingRows.innerHTML = `<tr><td colspan="${headers.length}">Sem dados para esse filtro.</td></tr>`;
    return;
  }

  els.rankingRows.innerHTML = rows
    .map((item) => {
      if (currentView === "clube") {
        return `<tr><td>${item.name}</td><td>${formatCurrency(item.spend)}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.linkClicks)}</td><td>${formatNumber(item.lpViews)}</td><td>${formatNumber(item.leads)}</td><td>${formatCurrency(item.leads ? item.spend / item.leads : 0)}</td><td>${formatNumber(item.engagement)}</td></tr>`;
      }
      if (currentView === "live") {
        return `<tr><td>${item.name}</td><td>${formatCurrency(item.spend)}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.clicks)}</td><td>${formatNumber(item.linkClicks)}</td><td>${formatNumber(item.outbound)}</td><td>${formatCurrency(item.outbound ? item.spend / item.outbound : 0)}</td><td>${formatNumber(item.engagement)}</td></tr>`;
      }
      return `<tr><td>${item.name}</td><td>${formatCurrency(item.spend)}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.linkClicks)}</td><td>${formatNumber(item.lpViews)}</td><td>${formatNumber(item.engagement)}</td><td>${formatNumber(item.saves)}</td><td>${formatPercent(item.impressions ? item.linkClicks / item.impressions : 0)}</td></tr>`;
    })
    .join("");
}

function renderInsights(m, data) {
  const messages = [];

  if (!data.length) {
    messages.push("Não há dados para esse filtro e período. Confira a nomenclatura da campanha ou aumente a janela de dias.");
  } else if (currentView === "ig") {
    messages.push(`<strong>${formatPercent(m.engagementRate)}</strong> de taxa de engajamento nos criativos de distribuição.`);
    messages.push(m.lpViews ? `Cada visita está custando <strong>${formatCurrency(m.cplp)}</strong>.` : "Ainda não há Landing Page Views neste filtro.");
    messages.push("Seguidores ainda não entram porque a RAW não tem uma coluna de follows/seguidores.");
  } else if (currentView === "clube") {
    messages.push(m.leads ? `O custo por lead está em <strong>${formatCurrency(m.cpLead)}</strong>.` : "Ainda não há leads para campanhas com CLUBE no período.");
    messages.push(`A taxa Link -> LP está em <strong>${formatPercent(m.linkToLp)}</strong>.`);
    messages.push(`A retenção de vídeo em 50% está em <strong>${formatPercent(m.retention50)}</strong>.`);
  } else {
    messages.push(`O custo por clique para WhatsApp está em <strong>${formatCurrency(m.outbound ? m.spend / m.outbound : 0)}</strong>.`);
    messages.push(`A taxa Link -> WhatsApp está em <strong>${formatPercent(m.linkClicks ? m.outbound / m.linkClicks : 0)}</strong>.`);
    messages.push(`A taxa Outbound -> LP está em <strong>${formatPercent(m.outboundToLp)}</strong>.`);
  }

  els.insights.innerHTML = messages.map((message) => `<div class="insight">${message}</div>`).join("");
}

function render() {
  const view = views[currentView];
  const data = filteredRows();
  const m = metrics(data);

  els.viewTitle.textContent = view.title;
  els.viewFilter.textContent = view.filterLabel;
  els.viewDescription.textContent = view.description;
  els.heroSpend.textContent = formatCurrency(m.spend);
  els.rankingHint.textContent = view.rankingHint;

  renderCards(m);
  renderRanking(data);
  renderInsights(m, data);
}

async function loadData() {
  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    rows = normalizeRows(await response.text());
    els.status.textContent = `${formatNumber(rows.length)} linhas carregadas`;
    render();
  } catch (error) {
    els.status.textContent = "Não foi possível carregar o Sheets";
    els.cards.innerHTML = card("Erro de conexão", "Sheets privado", "Publique a planilha ou libere acesso para leitura via link.");
    console.error(error);
  }
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentView = tab.dataset.view;
    els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

els.period.addEventListener("change", render);

loadData();
