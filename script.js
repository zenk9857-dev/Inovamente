
(() => {
  "use strict";

  const center = [-32.035, -52.098];

  const colors = {
    high: "#d93b45",
    medium: "#e58a20",
    low: "#e5bc31",
    clear: "#21875b",
  };

  const labels = {
    high: "Ponto crítico de lixo",
    medium: "Acúmulo moderado",
    low: "Pequeno acúmulo",
    clear: "Local limpo / lixo recolhido",
  };

  const $ = (id) => document.getElementById(id);

  const requiredIds = [
    "map",
    "toast",
    "activeCount",
    "highCount",
    "lastUpdate",
    "reports",
    "locateMe",
    "reportForm",
    "street",
    "neighborhood",
    "severity",
    "details",
    "centerMap",
    "refreshReports",
  ];

  const missingIds = requiredIds.filter((id) => !$(id));

  if (missingIds.length > 0) {
    console.error("Elementos não encontrados no HTML:", missingIds);
    alert("Elementos ausentes no HTML: " + missingIds.join(", "));
    return;
  }

  if (typeof L === "undefined") {
    alert("O mapa não foi carregado. Atualize a página e tente novamente.");
    return;
  }

  const map = L.map("map").setView(center, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const reportLayer = L.layerGroup().addTo(map);

  let selectedPoint = null;
  let selectionMarker = null;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const timeLabel = (date) => {
    if (!date) return "Data não informada";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Data não informada";
    }

    return parsedDate.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  function toast(message) {
    const element = $("toast");

    if (!element) {
      console.log(message);
      return;
    }

    element.textContent = message;
    element.style.display = "block";

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      element.style.display = "none";
    }, 5000);
  }

  // CONFIGURAÇÃO DO SUPABASE

  if (!window.ALERTA_CONFIG) {
    alert("Configuração do Supabase não encontrada. Verifique o config.js.");
    return;
  }

  if (
    !window.ALERTA_CONFIG.SUPABASE_URL ||
    !window.ALERTA_CONFIG.SUPABASE_PUBLISHABLE_KEY
  ) {
    alert("A URL ou a chave pública do Supabase não foi preenchida no config.js.");
    return;
  }

  if (typeof window.supabase === "undefined") {
    alert("A biblioteca do Supabase não foi carregada.");
    return;
  }

  const db = window.supabase.createClient(
    window.ALERTA_CONFIG.SUPABASE_URL,
    window.ALERTA_CONFIG.SUPABASE_PUBLISHABLE_KEY
  );

  // MARCAR LOCAL NO MAPA

  function createSelectionMarker(point, message) {
    selectedPoint = point;

    if (selectionMarker) {
      map.removeLayer(selectionMarker);
    }

    selectionMarker = L.marker(point)
      .addTo(map)
      .bindPopup(message)
      .openPopup();
  }

  // MOSTRAR RELATOS

  function renderReports(reports) {
    reportLayer.clearLayers();

    reports.forEach((report) => {
      const severity = labels[report.severity]
        ? report.severity
        : "medium";

      const lat = Number(report.lat);
      const lng = Number(report.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: colors[severity],
        fillOpacity: 0.95,
      }).addTo(reportLayer);

      marker.bindPopup(`
        <strong>${escapeHtml(report.street)}</strong>
        <br>
        ${escapeHtml(report.neighborhood || "Bairro não informado")}
        <br>
        <b>${escapeHtml(labels[severity])}</b>
        <br>
        ${escapeHtml(report.details || "Sem detalhes adicionais")}
        <br>
        <small>
          Enviado em ${timeLabel(report.created_at)}
          · Relato comunitário não verificado
        </small>
      `);
    });

    const activeReports = reports.filter(
      (report) => report.severity !== "clear"
    );

    $("activeCount").textContent = activeReports.length;

    $("highCount").textContent = reports.filter(
      (report) => report.severity === "high"
    ).length;

    $("lastUpdate").textContent = reports.length
      ? timeLabel(reports[0].created_at)
      : "Sem relatos";

    const box = $("reports");

    if (!reports.length) {
      box.innerHTML = `
        <div class="empty">
          Nenhum ponto informado por enquanto.
          Seja o primeiro a registrar um local.
        </div>
      `;
      return;
    }

    box.innerHTML = reports.slice(0, 8).map((report) => {
      const severity = labels[report.severity]
        ? report.severity
        : "medium";

      const complaintMessage = [
        "Olá, Eduarda! Gostaria de denunciar um possível relato falso ou desatualizado no Alerta Rio Grande.",
        "",
        "ID do relato: " + (report.id ?? "Não informado"),
        "Local: " + (report.street || "Não informado"),
        "Bairro: " + (report.neighborhood || "Não informado"),
        "Situação: " + labels[severity],
        "Detalhes: " + (report.details || "Não informado"),
        "",
        "Motivo da denúncia: ",
      ].join("\n");

      const complaintUrl =
        "https://wa.me/5553992048862?text=" +
        encodeURIComponent(complaintMessage);

      return `
        <article class="report">
          <div class="report-title">
            <span>${escapeHtml(report.street)}</span>

            <span class="badge ${severity}">
              ${escapeHtml(labels[severity])}
            </span>
          </div>

          <p>
            ${escapeHtml(report.neighborhood || "Bairro não informado")}
            · ${timeLabel(report.created_at)}
          </p>

          ${report.details ? `<p>${escapeHtml(report.details)}</p>` : ""}

          <div class="report-actions">
            <button
              class="secondary small"
              type="button"
              data-lat="${Number(report.lat)}"
              data-lng="${Number(report.lng)}"
            >
              Ver no mapa
            </button>

            <a
              class="action-link danger-link"
              href="${complaintUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Denunciar relato
            </a>
          </div>
        </article>
      `;
    }).join("");

    box.querySelectorAll("button[data-lat]").forEach((button) => {
      button.addEventListener("click", () => {
        const lat = Number(button.dataset.lat);
        const lng = Number(button.dataset.lng);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.setView([lat, lng], 17);
        }
      });
    });
  }

  // CARREGAR RELATOS DO SUPABASE

  async function loadReports(showError = true) {
    try {
      const { data, error } = await db
        .from("reports")
        .select(
          "id, street, neighborhood, severity, details, lat, lng, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(200);

      if (error) {
        console.error("Erro ao carregar relatos no Supabase:", error);

        $("reports").innerHTML = `
          <div class="empty">
            Não foi possível carregar os relatos:
            ${escapeHtml(error.message)}
          </div>
        `;

        if (showError) {
          toast("Erro ao carregar relatos: " + error.message);
        }

        return false;
      }

      renderReports(data || []);
      return true;

    } catch (error) {
      console.error("Falha inesperada ao carregar relatos:", error);

      $("reports").innerHTML = `
        <div class="empty">
          Falha de conexão ao carregar relatos:
          ${escapeHtml(error.message || error)}
        </div>
      `;

      if (showError) {
        toast(
          "Falha de conexão ao carregar relatos: " +
          (error.message || "verifique sua internet")
        );
      }

      return false;
    }
  }

  // SELECIONAR LOCAL CLICANDO NO MAPA

  map.on("click", (event) => {
    createSelectionMarker(
      [
        event.latlng.lat,
        event.latlng.lng,
      ],
      "Local selecionado para o novo relato"
    );

    toast("Local selecionado! Preencha o formulário.");
  });

  // LOCALIZAÇÃO DO USUÁRIO

  $("locateMe").addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Seu navegador não oferece suporte à localização.");
      return;
    }

    const button = $("locateMe");

    button.disabled = true;
    button.textContent = "📍 Localizando...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        map.setView(point, 17);

        createSelectionMarker(
          point,
          "Sua localização foi selecionada para o próximo relato"
        );

        toast("Localização encontrada!");

        button.disabled = false;
        button.textContent = "📍 Minha localização";
      },

      (error) => {
        console.error("Erro ao obter localização:", error);

        let message = "Não foi possível obter sua localização.";

        if (error.code === 1) {
          message = "Você não permitiu o acesso à localização.";
        }

        if (error.code === 2) {
          message = "Sua localização não pôde ser encontrada.";
        }

        if (error.code === 3) {
          message = "A localização demorou demais para responder.";
        }

        toast(message);

        button.disabled = false;
        button.textContent = "📍 Minha localização";
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });

  // PUBLICAR RELATO

  $("reportForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const street = $("street").value.trim();

    if (!street) {
      toast("Informe a rua ou o local.");
      $("street").focus();
      return;
    }

    if (!selectedPoint) {
      toast(
        "Marque o local no mapa ou use Minha localização antes de publicar."
      );
      return;
    }

    const point = selectedPoint;

    const submitButton = $("reportForm").querySelector(
      'button[type="submit"]'
    );

    if (!submitButton) {
      toast("Não foi possível encontrar o botão de publicação.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Publicando...";

    try {
      const { error } = await db
        .from("reports")
        .insert({
          street: street,

          neighborhood:
            $("neighborhood").value.trim() || null,

          severity:
            $("severity").value,

          details:
            $("details").value.trim() || null,

          lat: point[0],

          lng: point[1],
        });

      if (error) {
        console.error("Erro ao publicar relato no Supabase:", error);

        const extraInfo = [
          error.message,
          error.details,
          error.hint,
        ].filter(Boolean).join(" | ");

        toast("Erro ao publicar: " + extraInfo);
        return;
      }

      $("reportForm").reset();

      selectedPoint = null;

      if (selectionMarker) {
        map.removeLayer(selectionMarker);
        selectionMarker = null;
      }

      const refreshed = await loadReports(false);

      if (refreshed) {
        toast("Ponto publicado para todos os visitantes!");
      } else {
        toast(
          "Relato publicado, mas não foi possível atualizar a lista. Tente Atualizar."
        );
      }

    } catch (error) {
      console.error("Falha inesperada ao publicar relato:", error);

      toast(
        "Falha ao publicar: " +
        (error.message || "verifique sua conexão com a internet")
      );

    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Publicar ponto no mapa";
    }
  });

  // CENTRALIZAR MAPA

  $("centerMap").addEventListener("click", () => {
    map.setView(center, 13);
  });

  // ATUALIZAR RELATOS MANUALMENTE

  $("refreshReports").addEventListener("click", async () => {
    const refreshed = await loadReports();

    if (refreshed) {
      toast("Relatos atualizados.");
    }
  });

  // ATUALIZAÇÃO EM TEMPO REAL

  db
    .channel("pontos-de-lixo")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reports",
      },
      () => {
        loadReports(false);
      }
    )
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(
          "Erro na atualização em tempo real do Supabase:",
          error || status
        );
      }
    });

  // CARREGAMENTO INICIAL

  loadReports();

  // ATUALIZAÇÃO AUTOMÁTICA A CADA 30 SEGUNDOS

  setInterval(() => {
    loadReports(false);
  }, 30000);

})();
