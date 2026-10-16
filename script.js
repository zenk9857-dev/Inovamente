(() => {

  const center = [
    -32.035,
    -52.098
  ];


  const colors = {

    high: "#d93b45",

    medium: "#e58a20",

    low: "#e5bc31",

    clear: "#21875b",

  };


  const labels = {

    high:
      "Ponto crítico de lixo",

    medium:
      "Acúmulo moderado",

    low:
      "Pequeno acúmulo",

    clear:
      "Local limpo / lixo recolhido",

  };


  const $ = (id) =>
    document.getElementById(id);



  const map =
    L.map("map").setView(
      center,
      13
    );



  L.tileLayer(

    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

    {

      maxZoom: 19,

      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',

    }

  ).addTo(map);



  const reportLayer =
    L.layerGroup().addTo(map);



  let selectedPoint = null;

  let selectionMarker = null;



  const escapeHtml =
    (value) =>

      String(value ?? "")
        .replace(

          /[&<>"']/g,

          (character) =>

            ({

              "&":
                "&amp;",

              "<":
                "&lt;",

              ">":
                "&gt;",

              '"':
                "&quot;",

              "'":
                "&#39;",

            })[character]

        );



  const timeLabel =
    (date) =>

      new Date(date)
        .toLocaleString(

          "pt-BR",

          {

            day:
              "2-digit",

            month:
              "2-digit",

            hour:
              "2-digit",

            minute:
              "2-digit",

          }

        );



  function toast(message) {

    const element =
      $("toast");


    element.textContent =
      message;


    element.style.display =
      "block";


    clearTimeout(
      toast.timer
    );


    toast.timer =
      setTimeout(

        () => {

          element.style.display =
            "none";

        },

        3500

      );

  }



  if (
    !window.ALERTA_CONFIG
  ) {

    alert(
      "Configuração do Supabase não encontrada."
    );

    return;

  }



  if (
    !window.supabase
  ) {

    alert(
      "Biblioteca do Supabase não foi carregada."
    );

    return;

  }



  const db =

    window.supabase
      .createClient(

        window.ALERTA_CONFIG
          .SUPABASE_URL,

        window.ALERTA_CONFIG
          .SUPABASE_PUBLISHABLE_KEY

      );



  function createSelectionMarker(
    point,
    message
  ) {

    selectedPoint =
      point;


    if (
      selectionMarker
    ) {

      map.removeLayer(
        selectionMarker
      );

    }


    selectionMarker =

      L.marker(
        selectedPoint
      )

        .addTo(map)

        .bindPopup(
          message
        )

        .openPopup();

  }



  function renderReports(
    reports
  ) {


    reportLayer.clearLayers();



    reports.forEach(

      (report) => {


        const marker =

          L.circleMarker(

            [
              report.lat,
              report.lng
            ],

            {

              radius: 9,

              color:
                "#ffffff",

              weight: 2,

              fillColor:
                colors[
                  report.severity
                ] ||
                colors.medium,

              fillOpacity:
                0.95,

            }

          )

          .addTo(
            reportLayer
          );



        marker.bindPopup(`

          <strong>

            ${escapeHtml(
              report.street
            )}

          </strong>

          <br>

          ${escapeHtml(
            report.neighborhood ||
            "Bairro não informado"
          )}

          <br>

          <b>

            ${escapeHtml(
              labels[
                report.severity
              ] ||
              "Relato"
            )}

          </b>

          <br>

          ${escapeHtml(
            report.details ||
            "Sem detalhes adicionais"
          )}

          <br>

          <small>

            Enviado em

            ${timeLabel(
              report.created_at
            )}

            · relato comunitário

          </small>

        `);

      }

    );



    const activeReports =

      reports.filter(

        (report) =>
          report.severity !==
          "clear"

      );



    $("activeCount")
      .textContent =

      activeReports.length;



    $("highCount")
      .textContent =

      reports.filter(

        (report) =>
          report.severity ===
          "high"

      ).length;



    $("lastUpdate")
      .textContent =

      reports.length

        ? timeLabel(
            reports[0]
              .created_at
          )

        : "Sem relatos";



    const box =
      $("reports");



    if (
      !reports.length
    ) {

      box.innerHTML = `

        <div class="empty">

          Nenhum ponto informado
          por enquanto.

          Seja o primeiro a
          registrar um local.

        </div>

      `;


      return;

    }



    box.innerHTML =

      reports

        .slice(
          0,
          8
        )

        .map(

          (report) => `


            <article class="report">


              <div class="report-title">


                <span>

                  ${escapeHtml(
                    report.street
                  )}

                </span>


                <span
                  class="badge ${report.severity}"
                >

                  ${escapeHtml(
                    labels[
                      report.severity
                    ] ||
                    "Relato"
                  )}

                </span>


              </div>



              <p>

                ${escapeHtml(

                  report.neighborhood ||

                  "Bairro não informado"

                )}

                ·

                ${timeLabel(
                  report.created_at
                )}

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

      .querySelectorAll(
        "button[data-lat]"
      )

      .forEach(

        (button) => {


          button.addEventListener(

            "click",

            () => {


              map.setView(

                [

                  Number(
                    button.dataset.lat
                  ),

                  Number(
                    button.dataset.lng
                  ),

                ],

                17

              );

            }

          );

        }

      );

  }



  async function loadReports(
    showError = true
  ) {


    const {
      data,
      error
    } =

      await db

        .from(
          "reports"
        )

        .select(

          "id, street, neighborhood, severity, details, lat, lng, created_at"

        )

        .order(

          "created_at",

          {
            ascending: false
          }

        )

        .limit(
          200
        );



    if (
      error
    ) {


      console.error(
        error
      );


      if (
        showError
      ) {

        toast(
          "Erro ao carregar os relatos."
        );

      }


      return;

    }



    renderReports(
      data || []
    );

  }



  map.on(

    "click",

    (event) => {


      createSelectionMarker(

        [

          event.latlng.lat,

          event.latlng.lng,

        ],

        "Local selecionado para o novo relato"

      );



      toast(

        "Local selecionado. Agora preencha o formulário."

      );

    }

  );



  $("locateMe")
    .addEventListener(

      "click",

      () => {


        if (
          !navigator.geolocation
        ) {

          toast(

            "Seu navegador não oferece suporte à localização."

          );

          return;

        }



        const button =
          $("locateMe");


        button.disabled =
          true;


        button.textContent =
          "📍 Localizando...";



        navigator.geolocation
          .getCurrentPosition(


            (position) => {


              const point = [

                position.coords
                  .latitude,

                position.coords
                  .longitude,

              ];



              map.setView(
                point,
                17
              );



              createSelectionMarker(

                point,

                "Sua localização foi selecionada para o próximo relato"

              );



              toast(

                "Localização encontrada! O ponto já foi selecionado."

              );



              button.disabled =
                false;


              button.textContent =
                "📍 Minha localização";

            },



            (error) => {


              console.error(
                error
              );


              let message =

                "Não foi possível obter sua localização.";



              if (
                error.code === 1
              ) {

                message =

                  "Você não permitiu o acesso à localização.";

              }


              else if (
                error.code === 2
              ) {

                message =

                  "Sua localização não pôde ser encontrada.";

              }


              else if (
                error.code === 3
              ) {

                message =

                  "A localização demorou demais para responder.";

              }



              toast(
                message
              );



              button.disabled =
                false;


              button.textContent =
                "📍 Minha localização";

            },



            {

              enableHighAccuracy:
                true,

              timeout:
                10000,

              maximumAge:
                30000,

            }


          );

      }

    );



  $("reportForm")
    .addEventListener(

      "submit",

      async (event) => {


        event.preventDefault();



        const street =

          $("street")
            .value
            .trim();



        if (
          !street
        ) {

          return;

        }



        const point =

          selectedPoint ||
          center;



        const submitButton =

          $("reportForm")
            .querySelector(

              'button[type="submit"]'

            );



        submitButton.disabled =
          true;


        submitButton.textContent =
          "Publicando...";



        const {
          error
        } =

          await db

            .from(
              "reports"
            )

            .insert({

              street:
                street,

              neighborhood:

                $("neighborhood")
                  .value
                  .trim() ||

                null,

              severity:

                $("severity")
                  .value,

              details:

                $("details")
                  .value
                  .trim() ||

                null,

              lat:
                point[0],

              lng:
                point[1],

            });



        submitButton.disabled =
          false;


        submitButton.textContent =
          "Publicar ponto no mapa";



        if (
          error
        ) {


          console.error(
            error
          );


          toast(

            "Erro ao publicar o ponto."

          );


          return;

        }



        $("reportForm")
          .reset();



        selectedPoint =
          null;



        if (
          selectionMarker
        ) {

          map.removeLayer(
            selectionMarker
          );


          selectionMarker =
            null;

        }



        await loadReports(
          false
        );



        toast(

          "Ponto publicado para todos os visitantes!"

        );

      }

    );



  $("centerMap")
    .addEventListener(

      "click",

      () => {

        map.setView(
          center,
          13
        );

      }

    );



  $("refreshReports")
    .addEventListener(

      "click",

      async () => {


        await loadReports();


        toast(

          "Relatos atualizados."

        );

      }

    );



  db
    .channel(
      "pontos-de-lixo"
    )

    .on(

      "postgres_changes",

      {

        event:
          "*",

        schema:
          "public",

        table:
          "reports",

      },

      () => {

        loadReports(
          false
        );

      }

    )

    .subscribe();



  loadReports();



  setInterval(

    () => {

      loadReports(
        false
      );

    },

    30000

  );


})();