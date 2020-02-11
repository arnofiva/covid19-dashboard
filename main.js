require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/TileLayer",
  "esri/layers/FeatureLayer",
  "esri/renderers/smartMapping/statistics/summaryStatistics",
  "esri/core/promiseUtils",
  "esri/core/watchUtils"
], function(Map, SceneView, TileLayer, FeatureLayer, statistics, promiseUtils, watchUtils) {
  var url =
    "https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/ncov_cases/FeatureServer/1";

  var confirmedColor = "#ffdd30"; // "#E3C835"
  var countryColor = "#9FA5AB";
  var deathsColor = [255, 58, 48];

  var confirmed = new FeatureLayer({
    url,
    opacity: 1,
    outFields: ["*"],
  });
  var deaths = new FeatureLayer({
    url,
    opacity: 1,
    definitionExpression: "Deaths > 0",
    popupEnabled: false
  });
  var recovered = new FeatureLayer({
    url,
    opacity: 1,
    definitionExpression: "Recovered > 0",
    popupEnabled: false
  });

  var worldCountries = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",  // autocasts as new PolygonSymbol3D()
        symbolLayers: [
          {
            type: "fill",
            material: {
              color: "#9FA5AB",
            },
            outline: {
              color: "#3D4C57", //[0, 0, 0, 0.5],
              size: "1pt",
            }
          }
        ]
      },
    }
  });

  var worldCountriesExtruded = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    elevationInfo: {
      mode: "relative-to-ground",
      offset: -160000,
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",  // autocasts as new PolygonSymbol3D()
        symbolLayers: [
          {
            type: "extrude",  // autocasts as new ExtrudeSymbol3DLayer()
            size: 150000,  // 100,000 meters in height
            material: { color: "#9FA5AB" }, // [255, 255, 255, 0.5]
            // edges: {
            //   type: "solid", // autocasts as new SolidEdges3D()
            //   // color: "#3D4C57",
            //   size: "2px",
            // },
          }
        ]
      },
    }
  });

  var countries = new FeatureLayer({
    url:
      "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World__Countries_Generalized_analysis_trim/FeatureServer",
    definitionExpression: "ISO_2DIGIT NOT IN ('US', 'CA', 'CN', 'AU')",
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d", // autocasts as new PolygonSymbol3D()
        symbolLayers: [
          {
            type: "fill", // autocasts as new FillSymbol3DLayer()
            material: { color: [0, 0, 0, 0] },
            outline: {
              color: [255, 255, 255, 0.6],
              size: "1.5px"
            }
          }
        ]
      }
    }
  });

  var devisions = new FeatureLayer({
    url:
      "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Administrative_Divisions/FeatureServer",
    definitionExpression: "ISO_CC in ('CN', 'CA', 'US', 'AU')",
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d", // autocasts as new PolygonSymbol3D()
        symbolLayers: [
          {
            type: "fill", // autocasts as new FillSymbol3DLayer()
            material: { color: [0, 0, 0, 0] },
            outline: {
              color: [255, 255, 255, 0.6],
              size: "1px"
            }
          }
        ]
      }
    },
    minScale: null,
    maxScale: null
  });

  var map = new Map({
    layers: [confirmed, worldCountries],
    ground: {
      opacity: 1,
      surfaceColor: "#3D4C57",
    }
  });


  var view = new SceneView({
    container: "viewDiv",
    map: map,
    // qualityProfile: "high",
    padding: {
      right: 300,
    },
    environment: {
      background: {
        type: "color",
        color: "#3D4C57"
      },
      starsEnabled: false,
      atmosphereEnabled: false,
    },

    viewingMode: "global",
    // camera: {"position":{"spatialReference":{"latestWkid":3857,"wkid":102100},"x":25894517.749131426,"y":-24024418.483365063,"z":21554673.166552052},"heading":316.98163600465756,"tilt":56.04624468206751},

    // viewingMode: "local",
    // camera: {"position":{"spatialReference":{"latestWkid":3857,"wkid":102100},"x":25148433.234934397,"y":-11963402.146377262,"z":10427949.039143005},"heading":303.9286566604314,"tilt":66.07849294010876},
    // clippingArea: {
    //   spatialReference: {
    //     latestWkid: 3857,
    //     wkid: 102100
    //   },
    //   xmin: -20037507.067161843,
    //   ymin: -8245831.6271917485,
    //   xmax: 20037507.067161843,
    //   ymax: 18418386.309078343
    // }
  });

  view.when().then(() => {
    view.popup.defaultPopupTemplateEnabled = true;
    view.constraints.clipDistance.far *= 2;
  });
  
  

  var sumPopulation = {
    onStatisticField: "Confirmed",
    outStatisticFieldName: "ConfirmedSum",
    statisticType: "sum"
  };

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

  var totalConfirmed = 0;
  var totalDeaths = 0;
  var totalRecovered = 0;

  confirmed
    .queryFeatures(query)
    .then(result => {
      var stats = result.features[0].attributes;

      console.log("Stats", stats);

      totalConfirmed = stats.Confirmed_sum;
      totalDeaths = stats.Deaths_sum;
      totalRecovered = stats.Recovered_sum;
      removeHighlight();

      var scale = 5;

      var width = 60000 * scale;

      var minValue = 0; //Math.max(result.min, result.avg - result.stddev);
      var minSize = 40000 * scale;

      var maxValue = Math.min(
        stats.Confirmed_max,
        stats.Confirmed_avg + stats.Confirmed_stddev
      );
      var maxSize = 600000 * scale;

      console.log("MIN", minValue);
      console.log("MAX", maxValue);

      var confirmedHeight = `${minSize} + ((Min(${maxValue},$feature.Confirmed) - ${minValue})/(${maxValue} - ${minValue}))*(${maxSize} - ${minSize})`;

      var deathHeight = `($feature.Deaths/$feature.Confirmed)*(${confirmedHeight})`;
      var deathElevation = `IIf(0 < $feature.Deaths, ${deathHeight} + ${minSize}/10, 0)`;

      var recoveredHeight = `($feature.Recovered/$feature.Confirmed)*(${confirmedHeight})`;
      var recoveredElevation = `IIf(0 < $feature.Recovered, ${recoveredHeight} + ${minSize}/10, 0)`;

      confirmed.elevationInfo = {
        mode: "relative-to-ground",
      };

      confirmed.renderer = {
        type: "simple",
        symbol: {
          type: "point-3d",
          symbolLayers: [
            {
              type: "object",
              resource: {
                primitive: "tetrahedron"
              },
              material: {
                color: confirmedColor
              },
              width: width // * 0.60
            }
          ]
        },
        visualVariables: [
          {
            type: "size",
            valueExpression: confirmedHeight,
            axis: "height"
          },
          {
            type: "size",
            axis: "width-and-depth",
            useSymbolValue: true
          },
          {
            type: "color",
            field: "Confirmed",
            stops: [{
              value: 0,
              color: confirmedColor
            },
            {
              value: stats.Confirmed_avg,
              color: "#ffb730"
            }]
          }
        ]
      };

      enableQueries();
    })
    .catch(console.error);

  var lastCountryId = null;
  var countryHighlight = null;

  var confirmedHighlight = null;

  function removeHighlight() {
    if (countryHighlight) {
      countryHighlight.remove();
      countryHighlight = null;
    }
    if (confirmedHighlight) {
      confirmedHighlight.remove();
      confirmedHighlight = null;
    }
    lastCountryId = null;

    document.getElementById("dashboardConfirmed").innerText = totalConfirmed;
    document.getElementById("dashboardDeaths").innerText = totalDeaths;
    document.getElementById("dashboardRecovered").innerText = totalRecovered;
  }

  var queryStats = promiseUtils.debounce((mapPoint, countriesLV, confirmedLV) => {
    var query = countriesLV.createQuery();
    query.geometry = mapPoint;
    query.returnGeometry = true;
    return countriesLV.queryFeatures(query).then(result => {
      if (result.features.length) {
        var country = result.features[0];
        var objectId = country.getAttribute("FID");
        if (objectId === lastCountryId) {
          return;
        }
        removeHighlight();
        lastCountryId = objectId;

        var query = confirmedLV.createQuery();
        query.geometry = country.geometry;

        countryHighlight = countriesLV.highlight([country]);

        var statsQuery = query.clone();
        addOutStatistics(statsQuery);

        return promiseUtils.eachAlways([
          confirmedLV.queryObjectIds(query).then(objectIds => {
            confirmedHighlight = confirmedLV.highlight(objectIds);
          }),
          confirmedLV.queryFeatures(statsQuery).then(result => {
            debugger;
            var stats = result.features[0].attributes;
            document.getElementById("dashboardConfirmed").innerText = stats.Confirmed_sum || 0;
            document.getElementById("dashboardDeaths").innerText = stats.Deaths_sum || 0;
            document.getElementById("dashboardRecovered").innerText = stats.Recovered_sum || 0;
          })
        ]).catch(console.error);
      } else {
        removeHighlight();
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
          removeHighlight();
        }
      });
    });
  }

  var cases = new FeatureLayer({
    url:
      "https://services1.arcgis.com/0MSEUqKaxRlEPj5g/ArcGIS/rest/services/cases_time/FeatureServer/0"
  });
  cases.queryFeatures().then(result => {
    console.log("Cases", result);

    var labels = result.features.map(f =>
      moment(new Date(f.getAttribute("Report_Date"))).format("MMM Do")
    );
    var data = result.features.map(f => f.getAttribute("Total_Confirmed"));

    var ctx = document.getElementById('dashboardLinechart').getContext('2d');
    Chart.defaults.global.defaultColor = "white";
    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
              fill: false,
                label: 'Confirmed',
                backgroundColor: confirmedColor,
                borderColor: confirmedColor,
                data,
            }]
        },
        options: {
          animation: {
            duration: 0
          },
          legend: {
            display: false
          },
          aspectRatio: 1,
          title: {
            display: true,
            text: "Confirmed",
            fontColor: "white",
            fontFamily: "'Avenir Next W00','Helvetica Neue',Helvetica,Arial,sans-serif",
            fontSize: 16
          },
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
