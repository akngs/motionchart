var dataTable, chart;


window.addEventListener("DOMContentLoaded", function () {
  d3.csv(
    "ggi2016.csv",
    function (raw) {
      raw["year"] = +raw["year"];
      raw["overall"] = Math.max(+raw["overall"], 0) || 0;
      raw["economic"] = Math.max(+raw["economic"], 0) || 0;
      raw["education"] = Math.max(+raw["education"], 0) || 0;
      raw["health"] = Math.max(+raw["health"], 0) || 0;
      raw["political"] = Math.max(+raw["political"], 0) || 0;
      return raw;
    }
  ).then(function (data) {
    onLoad(data);
  });
});

function onLoad(data) {
  dataTable = new motionchart.DataTable(
    [
      {name: "country", label: "country", type: "string"},
      {name: "year", label: "year", type: "number"},
      {name: "overall", label: "overall", type: "number"},
      {name: "economic", label: "economic", type: "number"},
      {name: "education", label: "education", type: "number"},
      {name: "health", label: "health", type: "number"},
      {name: "political", label: "political", type: "number"}
    ],
    data
  );
  chart = new motionchart.Chart(
    dataTable,
    document.querySelector('#chart'),
    {
      xBoxPlot: true,
      yBoxPlot: true,
    }
  );

  chart.setC("country", "categorical");
  chart.setX("economic", "linear");
  chart.setY("political", "linear");
  chart.setR("overall", "linear");
  chart.animateUpdate = false;
}
