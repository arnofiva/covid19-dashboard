require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/FeatureLayer",
  "esri/core/promiseUtils",
  "esri/core/watchUtils",
  "esri/Graphic"
], function(Map, SceneView, FeatureLayer, promiseUtils, watchUtils, Graphic) {
  var url =
    "https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/ncov_cases/FeatureServer/1";

  var colors = {
    countries: "#9FA5AB",
    countriesOutline: "#3D4C57",

    confirmedLight: "#d5c058",// "#fff6cc",
    confirmed: "#ffdc2e",

    deathsLight: "#cb6762",// "#ffcfcc",
    deaths: "#ea4b43",

    recoveredLight: "#6dcb62",// "#d8f7d4",
    recovered: "#4fea3e",
  };

  var confirmed = new FeatureLayer({
    url,
    opacity: 1,
    outFields: ["*"],
  });

  var worldCountries = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    outFields: ["*"],
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",  // autocasts as new PolygonSymbol3D()
        symbolLayers: [
          {
            type: "fill",
            material: {
              color: colors.countries,
            },
            outline: {
              color: colors.countriesOutline,
              size: "1pt",
            }
          }
        ]
      },
    }
  });

  const graticule = new FeatureLayer({
    url: "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/World_graticule_15deg/FeatureServer",
    renderer: {
      type: "simple",
      symbol: {
        type: "line-3d",
        symbolLayers: [{
          type: "line",
          material: {
            color: colors.countries
          },
          size: "1pt",
        }]
      }
    },
    opacity: 1
  });

  var worldCountriesExtruded = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    elevationInfo: {
      mode: "relative-to-ground",
      offset: -80000,
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",
        symbolLayers: [
          {
            type: "extrude",
            size: 75000,
            material: { color: colors.countries },
          }
        ]
      },
    }
  });

  var map = new Map({
    layers: [confirmed, graticule, worldCountries, worldCountriesExtruded],
    ground: {
      opacity: 0,
      surfaceColor: colors.countriesOutline,
    }
  });


  var view = new SceneView({
    container: "viewDiv",
    map: map,
    // qualityProfile: "high",
    padding: {
      top: 80,
      right: 360,
    },
    environment: {
      background: {
        type: "color",
        color: colors.countriesOutline
      },
      starsEnabled: false,
      atmosphereEnabled: false,
    },

    viewingMode: "global",
    camera: {"position":{"spatialReference":{"latestWkid":4326,"wkid":4326},"x":131.86262861849988,"y":3.309571612356274,"z":20661501.503930703},"heading":15.36981324420197,"tilt":0.11792632041553405},
  });

  view.when().then(() => {
    view.popup.defaultPopupTemplateEnabled = false;
    view.popup.autoOpenEnabled = false;

    view.constraints.altitude.min = view.constraints.altitude.max / 2;
    view.constraints.clipDistance.far *= 2;
  });

  function addOutStatistics(query) {
    var stats = [];
    ["Confirmed", "Deaths", "Recovered"].forEach(field => {
      ["sum", "avg", "stddev", "max"].forEach(op => {
        stats.push({
          onStatisticField: field,
          outStatisticFieldName: `${field}_${op}`,
          statisticType: op
        });
      });
    });
    stats.push({
      onStatisticField: "Last_Update",
      outStatisticFieldName: "Last_Update_max",
      statisticType: "max"
    });
    query.outStatistics = stats;
  }

  var query = confirmed.createQuery();
  addOutStatistics(query);

  var ctx = document.getElementById('dashboardBarChart').getContext('2d');
  Chart.defaults.global.defaultColor = "white";
  Chart.defaults.global.defaultFontColor = "white";
  Chart.defaults.global.defaultFontFamily = "'Avenir Next W00','Helvetica Neue',Helvetica,Arial,sans-serif";

  var barChart = null;

  var stats;
  var totalConfirmed = 0;
  var totalDeaths = 0;
  var totalRecovered = 0;

  function updateBarChart(title, confirmed, recovered, deaths) {
    document.getElementById("dashboardConfirmed").innerText = confirmed || 0;
    document.getElementById("dashboardRecovered").innerText = recovered || 0;
    document.getElementById("dashboardDeaths").innerText = deaths || 0;
    document.getElementById("dashboardRegion").innerText = title;

    barChart.data.datasets[0].data[0] = confirmed || 0;
    barChart.data.datasets[0].data[1] = recovered || 0;
    barChart.data.datasets[0].data[2] = deaths || 0;
    barChart.update();
  }

  var lastField;
  function updateRenderer(field) {

    if (field === lastField) {
      return;
    }
    lastField = field;

    var scale = 5;

    var width = 30000 * scale;

    var minValue = 0;
    var minSize = 20000 * scale;

    var maxValue = stats.Confirmed_max / 3;
    var maxSize = 600000 * scale;

    confirmed.elevationInfo = {
      mode: "relative-to-ground",
    };

    var renderer = {
      type: "simple",
      symbol: {
        type: "point-3d",
        symbolLayers: [
          {
            type: "object",
            resource: {
              primitive: "cylinder"
            },
            material: {
              color: "#000000"
            },
            width: width // * 0.60
          }
        ]
      },
      visualVariables: [
        {
          type: "size",
          field,
          axis: "height",
          stops: [{
            value: 0,
            size: minSize
          },{
            value: maxValue,
            size: maxSize,
          }]
        },
        {
          type: "size",
          axis: "width-and-depth",
          useSymbolValue: true
        },
        {
          type: "color",
          field,
          stops: [{
            value: 0,
            color: [0, 0, 0, 0]
          },{
            value: 1,
            color: colors[`${field.toLowerCase()}Light`]
          },
          {
            value: stats[`${field}_avg`],
            color: colors[field.toLowerCase()]
          }]
        }
      ]
    };
    confirmed.renderer = renderer;
  }

  function onHover(_, actions) {
    var field = "Confirmed";
    switch(actions.length && actions[0]._index) {
      case 1:
        field = "Recovered";
        break;
      case 2:
        field = "Deaths";
        break;
      default:
        field = "Confirmed";
    }
    updateRenderer(field);
  }

  confirmed
    .queryFeatures(query)
    .then(result => {
      stats = result.features[0].attributes;

      totalConfirmed = stats.Confirmed_sum;
      totalDeaths = stats.Deaths_sum;
      totalRecovered = stats.Recovered_sum;

      barChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Confirmed", "Recovered", "Deaths"],
          datasets: [{
            backgroundColor: [colors.confirmed, colors.recovered, colors.deaths],

            barThickness: 6,
            maxBarThickness: 8,
            minBarLength: 100,
            data: [1, 2, 3]
          }]
        },
        options: {
          layout: {
            padding: {
              left: -20,
              right: 0,
              top: 0,
              bottom: 0
            }
          },
          tooltips: {
              enabled: false
          },
          legend: {
            display: false
          },
          // aspectRatio: 1,
          scales: {
            yAxes: [{
              ticks: {
                min: 0,
                max: totalConfirmed,
                display: false,
              },
              gridLines: {
                drawBorder: false,
                display: false,
              },
            }],
            xAxes: [{
              ticks: {
                beginAtZero: true,
                fontColor: "white",
                display: false,
              },
              gridLines: {
                drawBorder: false,
                display: false,
              },
            }],
          },
          onHover
        },
      });

      removeCountrySelection();
      updateRenderer("Confirmed");
      enableQueries();
    })
    .catch(console.error);

  var lastCountryId = null;
  function removeCountrySelection() {
    updateBarChart("Worldwide", totalConfirmed, totalRecovered, totalDeaths);
    view.graphics.removeAll();
  }

  var queryStats = promiseUtils.debounce((mapPoint, countriesLV, confirmedLV) => {
    var query = countriesLV.createQuery();
    query.geometry = mapPoint;
    query.returnGeometry = true;
    query.outFields = ["*"];
    return countriesLV.queryFeatures(query).then(result => {
      if (result.features.length) {
        var country = result.features[0];
        var objectId = country.getAttribute("FID");
        if (objectId === lastCountryId) {
          return;
        }

        lastCountryId = objectId;

        var query = confirmedLV.createQuery();
        query.geometry = country.geometry;

        var statsQuery = query.clone();
        removeCountrySelection();
        addOutStatistics(statsQuery);

        // countryHighlight = countriesLV.highlight([country]);
        view.graphics.add(new Graphic({
          geometry: country.geometry.clone(),
          symbol: {
            type: "polygon-3d",  // autocasts as new PolygonSymbol3D()
            symbolLayers: [{
              type: "fill",  // autocasts as new FillSymbol3DLayer()
              material: { color: [255, 255, 255, 0.7] }
            }]
          }
        }));


        return confirmedLV.queryObjectIds(query).then(objectIds => {
          // confirmedHighlight = confirmedLV.highlight(objectIds);
          return confirmedLV.queryFeatures(statsQuery).then(result => {
            var stats = result.features[0].attributes;
            updateBarChart(country.getAttribute("Country"), stats.Confirmed_sum || 0, stats.Recovered_sum || 0, stats.Deaths_sum || 0);
          })
        });
      } else {
        lastCountryId = null;
        removeCountrySelection();
      }
    });
  });


  function enableQueries() {

    watchUtils.whenFalseOnce(view, "updating").then(() => {
      return promiseUtils.eachAlways([worldCountries, confirmed].map(layer => view.whenLayerView(layer)));
    })
    .then(results => results.map(r => r.value))
    .then(layerViews => {
      view.on("pointer-move", function (event) {
        event.stopPropagation();
        var mapPoint = view.toMap(event);
        if (mapPoint) {
          queryStats(mapPoint, layerViews[0], layerViews[1]);
        } else {
          removeCountrySelection();
        }
      });
    });
  }

  var cases = new FeatureLayer({
    url:
      "https://services1.arcgis.com/0MSEUqKaxRlEPj5g/ArcGIS/rest/services/cases_time_v3/FeatureServer/0"
  });
  cases.queryFeatures().then(result => {
    var labels = result.features.map(f =>
      moment(new Date(f.getAttribute("Report_Date"))).format("MMM Do")
    );


    var confirmedData = result.features.map(f => f.getAttribute("Total_Confirmed"));
    var recoveredData = result.features.map(f => f.getAttribute("Total_Recovered"));

    var ctx = document.getElementById('dashboardLineChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
              fill: false,
                label: 'Confirmed',
                backgroundColor: colors.confirmed,
                borderColor: colors.confirmed,
                data: confirmedData,
            }, {
              fill: false,
                label: 'Recovered',
                backgroundColor: colors.recovered,
                borderColor: colors.recovered,
                data: recoveredData,
            }]
        },
        options: {
          animation: {
            duration: 0
          },
          legend: {
            display: false
          },
          // aspectRatio: 1,
          scales: {
              yAxes: [{
                  ticks: {
                      beginAtZero: true,
                      fontColor: "white",
                  }
              }],
              xAxes: [{
                ticks: {
                    beginAtZero: true,
                    fontColor: "white",
                }
            }]
          }
        }
    });
  });
});
