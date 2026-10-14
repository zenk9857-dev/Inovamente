(() => {
  const center = [-32.035, -52.098];

  const colors = {
    high: "#d93b45",
    medium: "#e58a20",
    low: "#e5bc31",
    clear: "#21875b",
  };

  const labels = {
    high: "Alagamento grave",
    medium: "Alagamento moderado",
    low: "Ponto de atenção",
    clear: "Via aparentemente liberada",
  };

  const $ = (id) => document.getElementById(id);

  const map = L.map("map").setView(center, 13);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    }
  ).addTo(map);

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

  const timeLabel = (date) =>
    new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  function toast(message) {
    const element = $("toast");

    element.textContent = message;
    element.style.display = "block";

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      element.style.display = "none";
    }, 3200);
  }

  if (!window.ALERTA_CONFIG) {
    alert("Configuração do Supabase não encontrada.");
    return;
  }

  if (!window.supabase) {
    alert("Biblioteca do Supabase não foi carregada.");
    return;
  }

  const db = window.supabase.createClient(
    window.ALERTA_CONFIG.SUPABASE_URL,
    window.ALERTA_CONFIG.SUPABASE_PUBLISHABLE_KEY
  );

  function renderReports(reports) {
    reportLayer.clearLayers();

    reports.forEach((report) => {
      const marker = L.circleMarker(
        [report.lat, report.lng],
        {
          radius: 9,
          color: "#fff",
          weight: 2,
          fillColor:
            colors[report.severity] || colors.medium,
          fillOpacity: 0.95,
        }
      ).addTo(reportLayer);

      marker.bindPopup(`
        <strong>${escapeHtml(report.street)}</strong><br>
        ${escapeHtml(
          report.neighborhood || "Bairro não informado"
        )}<br>

        <b>
          ${escapeHtml(
            labels[report.severity] || "Relato"
          )}
        </b><br>

        ${escapeHtml(
          report.details || "Sem detalhes adicionais"
        )}<br>

        <small>
          Enviado em ${timeLabel(report.created_at)}
          · relato comunitário não verificado
        </small>
      `);
    });

    const active = reports.filter(
      (report) => report.severity !== "clear"
    );

    $("activeCount").textContent = active.length;

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
          Nenhum relato por enquanto.
          Seja o primeiro a informar uma ocorrência.
        </div>
      `;

      return;
    }

    box.innerHTML = reports
      .slice(0, 8)
      .map(
        (report) => `
          <article class="report">

            <div class="report-title">

              <span>
                ${escapeHtml(report.street)}
              </span>

              <span class="badge ${report.severity}">
                ${escapeHtml(
                  labels[report.severity]
                )}
              </span>

            </div>

            <p>
              ${escapeHtml(
                report.neighborhood ||
                  "Bairro não informado"
              )}
              ·
              ${timeLabel(report.created_at)}
            </p>

            ${
              report.details
                ? `<p>${escapeHtml(
                    report.details
                  )}</p>`
                : ""
            }

            <button
              class="secondary small"
              type="button"
              data-lat="${report.lat}"
              data-lng="${report.lng}"
            >
              Ver no mapa
            </button>

          </article>
        `
      )
      .join("");

    box
      .querySelectorAll("button[data-lat]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          map.setView(
            [
              Number(button.dataset.lat),
              Number(button.dataset.lng),
            ],
            16
          );
        });
      });
  }

  async function loadReports() {
    const { data, error } = await db
      .from("reports")
      .select(
        "id, street, neighborhood, severity, details, lat, lng, created_at"
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);

      toast(
        "Erro ao carregar os relatos."
      );

      return;
    }

    renderReports(data || []);
  }

  map.on("click", (event) => {
    selectedPoint = [
      event.latlng.lat,
      event.latlng.lng,
    ];

    if (selectionMarker) {
      map.removeLayer(selectionMarker);
    }

    selectionMarker = L.marker(
      selectedPoint
    )
      .addTo(map)
      .bindPopup(
        "Local selecionado para o próximo relato"
      )
      .openPopup();

    toast(
      "Local selecionado. Agora preencha o formulário."
    );
  });

  $("reportForm").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const street =
        $("street").value.trim();

      if (!street) {
        return;
      }

      const point =
        selectedPoint || center;

      const submitButton =
        $("reportForm").querySelector(
          'button[type="submit"]'
        );

      submitButton.disabled = true;
      submitButton.textContent =
        "Publicando...";

      const { error } = await db
        .from("reports")
        .insert({
          street: street,

          neighborhood:
            $("neighborhood").value.trim() ||
            null,

          severity:
            $("severity").value,

          details:
            $("details").value.trim() ||
            null,

          lat: point[0],

          lng: point[1],
        });

      submitButton.disabled = false;

      submitButton.textContent =
        "Publicar relato no mapa";

      if (error) {
        console.error(error);

        toast(
          "Erro ao publicar o relato."
        );

        return;
      }

      $("reportForm").reset();

      selectedPoint = null;

      if (selectionMarker) {
        map.removeLayer(
          selectionMarker
        );

        selectionMarker = null;
      }

      await loadReports();

      toast(
        "Relato publicado para todos!"
      );
    }
  );

  $("centerMap").addEventListener(
    "click",
    () => {
      map.setView(center, 13);
    }
  );

  const updateButton =
    $("refreshReports") ||
    $("clearReports");

  if (updateButton) {
    updateButton.textContent =
      "Atualizar";

    updateButton.addEventListener(
      "click",
      async () => {
        await loadReports();

        toast(
          "Relatos atualizados."
        );
      }
    );
  }

  db
    .channel("relatos-publicos")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reports",
      },
      () => {
        loadReports();
      }
    )
    .subscribe();

  loadReports();

  setInterval(
    loadReports,
    30000
  );
})();