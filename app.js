const SHEET_ID = "1mMetboyVVyBDyGCtYAPOvQQHkt10NJ6QKMOeJy0isiU";
const SHEET_NAME = "RAW_Meta_Trafego";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

const views = {
  ig: {
    title: "Distribuição de Conteúdo",
    filter: "IG",
    filterLabel: "Campaign Name contém IG",
    description: "Acompanha se os criativos estão gerando atenção, visitas e engajamento para conteúdos.",
    rankingSort: "engagement",
    rankingHint: "Ordenado pelos criativos com mais engajamento.",
    mode: "distribution",
  },
  clube: {
    title: "Funil de Leads - Clube",
    filter: "CLUBE",
    filterLabel: "Campaign Name contém CLUBE",
    description: "Mostra o caminho entre clique, chegada na landing page e cadastro de lead para o Clube.",
    rankingSort: "leads",
    rankingHint: "Ordenado pelos criativos que mais geraram leads.",
    mode: "club",
  },
  live: {
    title: "Live 12/05 - Grupo WhatsApp",
    filter: "LIVE",
    filterLabel: "Campaign Name contém LIVE",
    description: "Mede o interesse na live e o custo das pessoas que clicaram para entrar no WhatsApp.",
    rankingSort: "outbound",
    rankingHint: "Ordenado pelos criativos com mais cliques para WhatsApp.",
    mode: "live",
  },
  all: {
    title: "Visão Geral - Todos os Funis",
    filter: "",
    filterLabel: "Todas as campanhas",
    description: "Consolida distribuição, Clube e Live para comparar o desempenho geral do tráfego.",
    rankingSort: "spend",
    rankingHint: "Ordenado pelos criativos com maior investimento.",
    mode: "all",
  },
};

let rows = [];
let currentView = "ig";

const els = {
  status: document.querySelector("#status"),
  period: document.querySelector("#period"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  customDates: document.querySelector("#customDates"),
  viewButtons: document.querySelectorAll("[data-view]"),
  viewFilter: document.querySelector("#viewFilter"),
  viewTitle: document.querySelector("#viewTitle"),
  viewDescription: document.querySelector("#viewDescription"),
  cards: document.querySelector("#cards"),
  dailyChart: document.querySelector("#dailyChart"),
  funnelChart: document.querySelector("#funnelChart"),
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

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

function getDateRange() {
  const validDates = rows.map((row) => parseDate(row.Day)).filter(Boolean).sort((a, b) => a - b);
  const first = validDates[0] || new Date();
  const last = validDates[validDates.length - 1] || new Date();

  if (els.period.value === "all") return { start: first, end: last };

  if (els.period.value === "custom") {
    const start = els.startDate.value ? new Date(`${els.startDate.value}T00:00:00`) : first;
    const end = els.endDate.value ? new Date(`${els.endDate.value}T23:59:59`) : last;
    return { start, end };
  }

  const days = Number(els.period.value);
  const end = last;
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1);
  return { start, end };
}

function filteredRows() {
  const view = views[currentView];
  const { start, end } = getDateRange();

  return rows.filter((row) => {
    const day = parseDate(row.Day);
    const campaign = String(row["Campaign Name"]).toUpperCase();
    const matchesView = view.filter ? campaign.includes(view.filter) : true;
    return day && day >= start && day <= end && matchesView;
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

function kpi(label, value, note, icon, variant = "neutral") {
  return `
    <article class="kpi-card ${variant}">
      <div class="kpi-card-inner">
        <div>
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${note}</small>
        </div>
        <div class="kpi-icon">${icon}</div>
      </div>
    </article>
  `;
}

function cardSet(m) {
  const common = [
    kpi("Gasto", formatCurrency(m.spend), "Quanto foi investido em mídia no período selecionado.", "R$", "primary"),
    kpi("Impressões", formatNumber(m.impressions), "Quantidade de vezes que os anúncios apareceram na tela.", "≡", "secondary"),
    kpi("Alcance", formatNumber(m.reach), "Número estimado de pessoas únicas impactadas pelos anúncios.", "◎", "neutral"),
    kpi("Frequência", formatNumber(m.frequency, 2), "Média de vezes que cada pessoa viu os anúncios.", "↻", "neutral"),
  ];

  if (currentView === "ig") {
    return [
      ...common,
      kpi("Visitas", formatNumber(m.lpViews), "Pessoas que clicaram e realmente carregaram a página.", "↗", "primary"),
      kpi("Custo por visita", formatCurrency(m.cplp), "Quanto custa, em média, levar uma pessoa até a página.", "R$", "secondary"),
      kpi("Engajamentos", formatNumber(m.engagement), "Curtidas, comentários, salvamentos, compartilhamentos e interações no anúncio.", "★", "neutral"),
      kpi("Taxa de engajamento", formatPercent(m.engagementRate), "Percentual das impressões que viraram interação no anúncio.", "%", "neutral"),
      kpi("Post Saves", formatNumber(m.saves), "Salvamentos indicam que o conteúdo foi percebido como útil ou relevante.", "S", "neutral"),
      kpi("Retenção 50%", formatPercent(m.retention50), "Mostra quantas pessoas chegaram à metade do vídeo depois dos primeiros 3 segundos.", "50", "neutral"),
      kpi("Seguidores", "Sem coluna", "Para medir seguidores, adicione a métrica de follows no relatório do Adveronix.", "+", "neutral"),
      kpi("Content Views", formatNumber(m.contentViews), "Visualizações de conteúdo no site quando esse evento estiver configurado.", "V", "neutral"),
    ];
  }

  if (currentView === "clube") {
    return [
      ...common,
      kpi("Link Clicks", formatNumber(m.linkClicks), "Pessoas que clicaram no link ou botão do anúncio.", "↗", "primary"),
      kpi("LP Views", formatNumber(m.lpViews), "Cliques que conseguiram carregar a landing page.", "LP", "secondary"),
      kpi("Leads", formatNumber(m.leads), "Pessoas que deixaram cadastro na landing page.", "L", "neutral"),
      kpi("Custo por Lead", formatCurrency(m.cpLead), "Quanto custou, em média, cada cadastro gerado.", "R$", "neutral"),
      kpi("CTR Link", formatPercent(m.ctr), "Percentual das impressões que geraram clique no link.", "%", "neutral"),
      kpi("CPC Link", formatCurrency(m.cpc), "Quanto custou, em média, cada clique no link.", "R$", "neutral"),
      kpi("Taxa LP -> Lead", formatPercent(m.lpToLead), "Percentual de visitantes da página que viraram lead.", "%", "neutral"),
      kpi("Retenção 50%", formatPercent(m.retention50), "Sinal de qualidade e retenção dos vídeos usados no funil.", "50", "neutral"),
    ];
  }

  if (currentView === "live") {
    return [
      ...common,
      kpi("Clicks", formatNumber(m.clicks), "Todos os cliques registrados nos anúncios da live.", "↯", "primary"),
      kpi("Link Clicks", formatNumber(m.linkClicks), "Cliques no link ou botão principal do anúncio.", "↗", "secondary"),
      kpi("WhatsApp", formatNumber(m.outbound), "Cliques de saída para entrar no grupo ou acessar o WhatsApp.", "W", "neutral"),
      kpi("Custo por WhatsApp", formatCurrency(m.outbound ? m.spend / m.outbound : 0), "Quanto custa cada clique de intenção para o WhatsApp.", "R$", "neutral"),
      kpi("CTR Link", formatPercent(m.ctr), "Percentual das impressões que viraram clique no link.", "%", "neutral"),
      kpi("CPC Link", formatCurrency(m.cpc), "Custo médio por clique no link da live.", "R$", "neutral"),
      kpi("Taxa Link -> WhatsApp", formatPercent(m.linkClicks ? m.outbound / m.linkClicks : 0), "Mostra quantos cliques no link viraram saída para WhatsApp.", "%", "neutral"),
      kpi("Retenção 50%", formatPercent(m.retention50), "Sinal de quanto os vídeos estão segurando atenção.", "50", "neutral"),
    ];
  }

  return [
    ...common,
    kpi("Link Clicks", formatNumber(m.linkClicks), "Cliques no link dos anúncios de todos os funis.", "↗", "primary"),
    kpi("Outbound", formatNumber(m.outbound), "Cliques de saída para fora do Meta.", "→", "secondary"),
    kpi("LP Views", formatNumber(m.lpViews), "Pessoas que carregaram a página depois do clique.", "LP", "neutral"),
    kpi("Leads", formatNumber(m.leads), "Total de cadastros captados nas campanhas.", "L", "neutral"),
    kpi("CTR Link", formatPercent(m.ctr), "Percentual das impressões que geraram clique no link.", "%", "neutral"),
    kpi("CPC Link", formatCurrency(m.cpc), "Custo médio por clique no link.", "R$", "neutral"),
    kpi("Engajamentos", formatNumber(m.engagement), "Interações totais nos anúncios.", "★", "neutral"),
    kpi("Retenção 50%", formatPercent(m.retention50), "Retenção média dos vídeos até metade.", "50", "neutral"),
  ];
}

function dailyGroups(data) {
  const groups = new Map();
  for (const row of data) {
    const day = parseDate(row.Day);
    if (!day) continue;
    const key = dateKey(day);
    const item = groups.get(key) || { date: day, spend: 0, lpViews: 0, leads: 0, outbound: 0, engagement: 0 };
    item.spend += number(row["Amount Spent"]);
    item.lpViews += number(row["Landing Page Views"]);
    item.leads += number(row.Leads);
    item.outbound += number(row["Outbound Clicks"]);
    item.engagement += number(row["Inline Post Engagement in Ad"]);
    groups.set(key, item);
  }
  return [...groups.values()].sort((a, b) => a.date - b.date);
}

function renderDailyChart(data) {
  const grouped = dailyGroups(data).slice(-14);
  const metric = currentView === "clube" ? "leads" : currentView === "live" ? "outbound" : "engagement";
  const label = currentView === "clube" ? "leads" : currentView === "live" ? "WhatsApp" : "engaj.";
  const max = Math.max(...grouped.map((item) => item[metric]), 1);

  if (!grouped.length) {
    els.dailyChart.innerHTML = `<div class="insight">Sem dados para montar o gráfico neste período.</div>`;
    return;
  }

  els.dailyChart.innerHTML = grouped
    .map((item) => {
      const height = Math.max((item[metric] / max) * 100, 3);
      return `
        <div class="day-bar">
          <div class="bar-track"><div class="bar-fill" style="height:${height}%"></div></div>
          <strong>${formatNumber(item[metric])}</strong>
          <span>${formatShortDate(item.date)} · ${label}</span>
        </div>
      `;
    })
    .join("");
}

function renderFunnel(m) {
  const steps =
    currentView === "clube"
      ? [
          ["Impressões", m.impressions],
          ["Link Clicks", m.linkClicks],
          ["LP Views", m.lpViews],
          ["Leads", m.leads],
        ]
      : currentView === "live"
        ? [
            ["Impressões", m.impressions],
            ["Link Clicks", m.linkClicks],
            ["Outbound WhatsApp", m.outbound],
            ["LP Views", m.lpViews],
          ]
        : [
            ["Impressões", m.impressions],
            ["Alcance", m.reach],
            ["Engajamentos", m.engagement],
            ["LP Views", m.lpViews],
          ];

  const max = Math.max(steps[0][1], 1);
  els.funnelChart.innerHTML = steps
    .map(([label, value]) => {
      const width = Math.max((value / max) * 100, value ? 4 : 0);
      return `
        <div class="funnel-row">
          <div class="funnel-meta"><span>${label}</span><strong>${formatNumber(value)}</strong></div>
          <div class="funnel-track"><div class="funnel-fill" style="width:${width}%"></div></div>
        </div>
      `;
    })
    .join("");
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
  return [...groups.values()].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 12);
}

function renderRanking(data) {
  const rows = groupedCreatives(data);
  const headers =
    currentView === "clube"
      ? ["Criativo", "Gasto", "Impressões", "Link Clicks", "LP Views", "Leads", "CPL", "CTR"]
      : currentView === "live"
        ? ["Criativo", "Gasto", "Impressões", "Clicks", "Link Clicks", "WhatsApp", "Custo", "CTR"]
        : ["Criativo", "Gasto", "Impressões", "Link Clicks", "LP Views", "Engaj.", "Saves", "CTR"];

  els.rankingHeader.innerHTML = headers.map((item) => `<th>${item}</th>`).join("");

  if (!rows.length) {
    els.rankingRows.innerHTML = `<tr><td colspan="${headers.length}">Sem dados para esse filtro.</td></tr>`;
    return;
  }

  els.rankingRows.innerHTML = rows
    .map((item) => {
      const ctr = item.impressions ? item.linkClicks / item.impressions : 0;
      if (currentView === "clube") {
        return `<tr><td>${item.name}</td><td>${formatCurrency(item.spend)}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.linkClicks)}</td><td>${formatNumber(item.lpViews)}</td><td>${formatNumber(item.leads)}</td><td>${formatCurrency(item.leads ? item.spend / item.leads : 0)}</td><td>${formatPercent(ctr)}</td></tr>`;
      }
      if (currentView === "live") {
        return `<tr><td>${item.name}</td><td>${formatCurrency(item.spend)}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.clicks)}</td><td>${formatNumber(item.linkClicks)}</td><td>${formatNumber(item.outbound)}</td><td>${formatCurrency(item.outbound ? item.spend / item.outbound : 0)}</td><td>${formatPercent(ctr)}</td></tr>`;
      }
      return `<tr><td>${item.name}</td><td>${formatCurrency(item.spend)}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.linkClicks)}</td><td>${formatNumber(item.lpViews)}</td><td>${formatNumber(item.engagement)}</td><td>${formatNumber(item.saves)}</td><td>${formatPercent(ctr)}</td></tr>`;
    })
    .join("");
}

function renderInsights(m, data) {
  const messages = [];

  if (!data.length) {
    messages.push("Não há dados para esse filtro e período. Confira se a campanha contém a palavra-chave certa ou aumente a janela de datas.");
  } else {
    messages.push(`<strong>Gasto</strong> é o valor investido em mídia. Ele ajuda o cliente a entender quanto foi necessário para gerar os resultados exibidos.`);
    messages.push(`<strong>CTR Link</strong> mostra se o criativo e a chamada estão fazendo as pessoas clicarem. Quanto maior, mais atrativo o anúncio tende a ser.`);
    messages.push(`<strong>CPC Link</strong> é o custo médio por clique no link. Ele mostra se o tráfego está ficando caro ou barato.`);

    if (currentView === "ig") {
      messages.push(`<strong>Taxa de engajamento</strong> está em ${formatPercent(m.engagementRate)}. Ela mostra quanto o conteúdo gerou reação em relação ao volume entregue.`);
      messages.push(`<strong>Retenção 50%</strong> está em ${formatPercent(m.retention50)}. Ela ajuda a entender se o vídeo segura atenção até a metade.`);
    } else if (currentView === "clube") {
      messages.push(`<strong>Custo por Lead</strong> está em ${formatCurrency(m.cpLead)}. É quanto custa, em média, cada cadastro na landing page.`);
      messages.push(`<strong>Taxa LP -> Lead</strong> está em ${formatPercent(m.lpToLead)}. Ela mostra se a página está convencendo quem chegou nela.`);
    } else if (currentView === "live") {
      messages.push(`<strong>Custo por WhatsApp</strong> está em ${formatCurrency(m.outbound ? m.spend / m.outbound : 0)}. É o custo por pessoa que demonstrou intenção de entrar no grupo.`);
      messages.push(`<strong>Taxa Link -> WhatsApp</strong> está em ${formatPercent(m.linkClicks ? m.outbound / m.linkClicks : 0)}. Ela mostra se o clique está chegando na ação esperada.`);
    } else {
      messages.push(`<strong>Visão Todos</strong> serve para comparar o volume total e identificar quais criativos concentram mais verba e resultado.`);
      messages.push(`<strong>Resultado por criativo</strong> mostra quais anúncios merecem escala, ajuste ou pausa.`);
    }
  }

  els.insights.innerHTML = messages.map((message) => `<div class="insight">${message}</div>`).join("");
}

function render() {
  const view = views[currentView];
  const data = filteredRows();
  const m = metrics(data);

  els.customDates.classList.toggle("is-visible", els.period.value === "custom");
  els.viewTitle.textContent = view.title;
  els.viewFilter.textContent = view.filterLabel;
  els.viewDescription.textContent = view.description;
  els.rankingHint.textContent = view.rankingHint;
  els.cards.innerHTML = cardSet(m).join("");

  renderDailyChart(data);
  renderFunnel(m);
  renderRanking(data);
  renderInsights(m, data);
}

function setDefaultCustomDates() {
  const validDates = rows.map((row) => parseDate(row.Day)).filter(Boolean).sort((a, b) => a - b);
  if (!validDates.length) return;
  els.startDate.value = dateKey(validDates[0]);
  els.endDate.value = dateKey(validDates[validDates.length - 1]);
}

async function loadData() {
  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    rows = normalizeRows(await response.text());
    setDefaultCustomDates();
    els.status.textContent = `${formatNumber(rows.length)} linhas carregadas`;
    render();
  } catch (error) {
    els.status.textContent = "Não foi possível carregar o Sheets";
    els.cards.innerHTML = kpi("Erro de conexão", "Sheets privado", "Publique a planilha ou libere acesso para leitura via link.", "!", "primary");
    console.error(error);
  }
}

els.viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    els.viewButtons.forEach((item) => item.classList.toggle("is-active", item.dataset.view === currentView));
    render();
  });
});

els.period.addEventListener("change", render);
els.startDate.addEventListener("change", render);
els.endDate.addEventListener("change", render);

loadData();
