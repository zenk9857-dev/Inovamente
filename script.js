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

  const map = L.map("map").setView(center, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  }).addTo(map);

  const reportLayer = L.layerGroup().addTo(map);

  let selectedPoint = null;
  let selectionMarker = null;

  const $ = (id) => document.getElementById(id);

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  const readReports = () => {
    try {
      return JSON.parse(
        localStorage.getItem("alertaRioGrandeReports") || "[]",
      );
    } catch {
      return [];
    }
  };

  const saveReports = (data) => {
    localStorage.setItem(
      "alertaRioGrandeReports",
      JSON.stringify(data),
    );
  };

  const timeLabel = (date) =>
    new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  function toast(message) {
    const toastElement = $("toast");

    toastElement.textContent = message;
    toastElement.style.display = "block";

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      toastElement.style.display = "none";
    }, 3200);
  }

  function draw() {
    const reports = readReports();

    reportLayer.clearLayers();

    reports.forEach((report) => {
      const marker = L.circleMarker(
        [report.lat, report.lng],
        {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: colors[report.severity] || colors.medium,
          fillOpacity: 0.95,
        },
      ).addTo(reportLayer);

      marker.bindPopup(`
        <strong>${escapeHtml(report.street)}</strong><br>

        ${escapeHtml(
          report.neighborhood || "Bairro não informado",
        )}<br>

        <b>
          ${escapeHtml(
            labels[report.severity] || "Relato",
          )}
        </b><br>

        ${escapeHtml(
          report.details || "Sem detalhes adicionais",
        )}<br>

        <small>
          Enviado em ${timeLabel(report.createdAt)} ·
          relato comunitário não verificado
        </small>
      `);
    });

    const activeReports = reports.filter(
      (report) => report.severity !== "clear",
    );

    $("activeCount").textContent = activeReports.length;

    $("highCount").textContent = reports.filter(
      (report) => report.severity === "high",
    ).length;

    $("lastUpdate").textContent = reports.length
      ? timeLabel(
          Math.max(
            ...reports.map((report) =>
              new Date(report.createdAt).getTime(),
            ),
          ),
        )
      : "Sem relatos";

    const reportsBox = $("reports");

    if (!reports.length) {
      reportsBox.innerHTML = `
        <div class="empty">
          Nenhum relato por enquanto.
          Seja o primeiro a informar uma ocorrência.
        </div>
      `;

      return;
    }

    reportsBox.innerHTML = [...reports]
      .sort(
        (firstReport, secondReport) =>
          new Date(secondReport.createdAt) -
          new Date(firstReport.createdAt),
      )
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
                  labels[report.severity],
                )}
              </span>
            </div>

            <p>
              ${escapeHtml(
                report.neighborhood ||
                  "Bairro não informado",
              )}
              · ${timeLabel(report.createdAt)}
            </p>

            ${
              report.details
                ? `<p>${escapeHtml(report.details)}</p>`
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
        `,
      )
      .join("");

    reportsBox
      .querySelectorAll("button[data-lat]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          map.setView(
            [
              Number(button.dataset.lat),
              Number(button.dataset.lng),
            ],
            16,
          );
        });
      });
  }

  map.on("click", (event) => {
    selectedPoint = [
      event.latlng.lat,
      event.latlng.lng,
    ];

    if (selectionMarker) {
      map.removeLayer(selectionMarker);
    }

    selectionMarker = L.marker(selectedPoint)
      .addTo(map)
      .bindPopup(
        "Local selecionado para o próximo relato",
      )
      .openPopup();

    toast(
      "Local selecionado. Preencha o formulário e publique o relato.",
    );
  });

  $("reportForm").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const street = $("street").value.trim();

      if (!street) {
        return;
      }

      const point = selectedPoint || center;

      const reports = readReports();

      reports.push({
        id:
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 7),

        street,

        neighborhood:
          $("neighborhood").value.trim(),

        severity:
          $("severity").value,

        details:
          $("details").value.trim(),

        lat: point[0],
        lng: point[1],

        createdAt:
          new Date().toISOString(),
      });

      saveReports(reports);

      draw();

      $("reportForm").reset();

      selectedPoint = null;

      if (selectionMarker) {
        map.removeLayer(selectionMarker);
        selectionMarker = null;
      }

      toast(
        "Relato salvo neste navegador e exibido no mapa.",
      );
    },
  );

  $("centerMap").addEventListener(
    "click",
    () => {
      map.setView(center, 13);
    },
  );

  $("clearReports").addEventListener(
    "click",
    () => {
      if (!readReports().length) {
        toast("Não há relatos para limpar.");
        return;
      }

      const shouldClear = confirm(
        "Apagar todos os relatos salvos neste navegador?",
      );

      if (shouldClear) {
        saveReports([]);

        draw();

        toast("Relatos removidos.");
      }
    },
  );

  // Atualiza a interface periodicamente.
  // Os dados continuam locais e não representam
  // um feed oficial em tempo real.

  setInterval(draw, 30000);

  draw();
})();