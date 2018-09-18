var motionchart = (function (d3) {
  'use strict';

  var Dimension = /** @class */ (function () {
      function Dimension(label, name, getter, scale) {
          this.label = label;
          this.name = name;
          this.getter = getter;
          this.scale = scale;
      }
      Dimension.prototype.raw = function (d) {
          return this.getter(d);
      };
      Dimension.prototype.scaled = function (d) {
          return this.scale(this.getter(d));
      };
      Dimension.prototype.isConstant = function () {
          return !!this.scale.constant;
      };
      return Dimension;
  }());

  function find(data, func) {
      for (var i = 0; i < data.length; i++)
          if (func(data[i]))
              return data[i];
      return undefined;
  }
  function isInRange(value, range) {
      return range[0] <= value && value <= range[1];
  }
  // const formatMillisecond = d3.timeFormat(".%L")
  // const formatSecond = d3.timeFormat(":%S")
  // const formatMinute = d3.timeFormat("%I:%M")
  // const formatHour = d3.timeFormat("%I %p")
  // const formatDay = d3.timeFormat("%a %d")
  // const formatWeek = d3.timeFormat("%b %d")
  // const formatMonth = d3.timeFormat("%B")
  // const formatYear = d3.timeFormat("%Y")
  //
  // export function multiscaleTimeFormat(date: Date): string {
  //   return (d3.timeSecond(date) < date ? formatMillisecond
  //     : d3.timeMinute(date) < date ? formatSecond
  //       : d3.timeHour(date) < date ? formatMinute
  //         : d3.timeDay(date) < date ? formatHour
  //           : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
  //             : d3.timeYear(date) < date ? formatMonth
  //               : formatYear)(date)
  // }

  var CFG = {
      // Main
      DATA_CIRCLE_OPACITY: 0.9,
      DATA_CIRCLE_MIN_R: 2,
      DATA_CIRCLE_MAX_R_RATIO: 0.05,
      DATA_CIRCLE_STROKE: "#000000",
      DATA_CIRCLE_DEFAULT_FILL: "steelblue",
      // Canvas
      CANVAS_STROKE_COLOR: "none",
      CANVAS_FILL_COLOR: "none",
      // Axis and grids
      GRID_PIXELS_PER_TICK: 100,
      GRID_STROKE_COLOR: "#DDDDDD",
      GRID_STROKE_OPACITY: 0.5,
      AXIS_TICK_VALUE_COLOR: "#888888",
      AXIS_TICK_LABEL_COLOR: "#000000",
      // Boxplot and dots
      BOXPLOT_SIZE: 20,
      BOXPLOT_PADDING: 4,
      BOXPLOT_POINT_FILL_COLOR: "#000000",
      BOXPLOT_STROKE_COLOR: "#666666",
      BOXPLOT_DOT_OPACITY: 0.3,
      BOXPLOT_OUTLIER_OPACITY: 0.6,
      BOXPLOT_DOT_R: 2,
      BOXPLOT_OUTLIER_R: 2,
      // Margin
      MARGIN_T: 0,
      MARGIN_L: 0,
      MARGIN_R: 0,
      MARGIN_B: 0,
  };
  var Chart = /** @class */ (function () {
      function Chart(dataTable, element, options) {
          var _this = this;
          if (element.innerHTML.trim())
              throw new Error("element is not empty");
          this.dataTable = dataTable;
          this.options = options;
          this.lastUpdate = 0;
          this.needUpdate = false;
          this.animateUpdate = false;
          this.x = this.createDim("x", "", "constant");
          this.y = this.createDim("y", "", "constant");
          this.r = this.createDim("r", "", "constant");
          this.c = this.createDim("c", "", "constant");
          this.t = d3.scaleTime();
          // Initialize internal elements
          this.element = element;
          this.element.innerHTML = "\n      <span style=\"display: block; width: 100%; height: 100%; padding: 0; border: 0; margin: 0; overflow: hidden;\">\n        <svg style=\"display: block; padding: 0; margin: 0; border: 0; shape-rendering: crispEdges;\">\n          <g class=\"root\">\n            <rect class=\"canvas-bg\" x=\"0\" y=\"0\" width=\"0\" height=\"0\" />\n            <g class=\"axis axis-x\"></g>\n            <g class=\"axis axis-y\"></g>\n            <g class=\"boxplot boxplot-x\"></g>\n            <g class=\"boxplot boxplot-y\"></g>\n            <g class=\"canvas\"></g>\n          </g>\n        </svg>\n      </span>\n    ";
          var wrapper = this.element.firstElementChild;
          this.svg = wrapper.firstElementChild;
          this.fit();
          this.onDataChange();
          this.onScreenChange();
          this.setProgress(0.0, true);
          // Register resize handler
          var window = this.element.ownerDocument.defaultView;
          window.addEventListener("resize", function () {
              _this.fit();
              _this.onScreenChange();
          });
          this.triggerUpdate(false);
          this.startUpdater();
      }
      Chart.prototype.setProgress = function (rate, animate) {
          var extent = this.t.domain();
          var min = +extent[0];
          var max = +extent[1];
          var newTime = (max - min) * rate + min;
          if (this.currentTime === newTime)
              return;
          this.currentTime = newTime;
          this.triggerUpdate(animate);
      };
      Chart.prototype.setX = function (colName, scaleName, options) {
          this.x = this.createDim("x", colName, scaleName, options);
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.unsetX = function () {
          this.x = this.createDim("x", "", "constant");
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.setY = function (colName, scaleName, options) {
          this.y = this.createDim("y", colName, scaleName, options);
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.unsetY = function () {
          this.y = this.createDim("y", "", "constant");
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.setR = function (colName, scaleName, options) {
          this.r = this.createDim("r", colName, scaleName, options);
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.unsetR = function () {
          this.r = this.createDim("r", "", "constant");
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.setC = function (colName, scaleName, options) {
          this.c = this.createDim("c", colName, scaleName, options);
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.unsetC = function () {
          this.c = this.createDim("c", "", "constant");
          this.onDataChange();
          this.onScreenChange();
          this.triggerUpdate(true);
      };
      Chart.prototype.createDim = function (dimName, colName, scaleName, options) {
          if (["x", "y", "r", "c"].indexOf(dimName) === -1)
              throw new Error("Invalid dimension: " + dimName);
          if (["constant", "linear", "sqrt", "sequential", "categorical"].indexOf(scaleName) === -1)
              throw new Error("Invalid scale: " + scaleName);
          if (scaleName === "constant")
              return new Dimension("", "", function (d) { return d[colName]; }, constantScale());
          var columnType = this.dataTable.getColumnType(colName);
          options = options || {};
          var validMappings = [
              ["x", "linear", "number", function () { return d3.scaleLinear(); }],
              ["y", "linear", "number", function () { return d3.scaleLinear(); }],
              ["r", "linear", "number", function () { return d3.scaleLinear(); }],
              ["r", "sqrt", "number", function () { return d3.scaleSqrt(); }],
              ["c", "sequential", "number", function () { return d3.scaleSequential(d3.interpolateViridis); }],
              ["c", "categorical", "string", function () { return d3.scaleOrdinal(d3.schemePaired); }],
          ];
          var maps = validMappings
              .filter(function (m) { return m[0] === dimName && m[1] === scaleName && m[2] === columnType.type; });
          if (!maps.length)
              throw new Error("Incompatible dimension \"" + dimName + "\", scale \"" + scaleName + "\", and type \"" + columnType.type + "\"");
          var scaleFactory = maps[0][3];
          var scale = scaleFactory();
          return new Dimension(columnType.label, columnType.name, function (d) { return d[colName]; }, scale);
      };
      /**
       * Change size of SVG to fill outer element
       */
      Chart.prototype.fit = function () {
          var wrapper = this.element.firstElementChild;
          var wrapperWidth = wrapper.clientWidth;
          var wrapperHeight = wrapper.clientHeight;
          var width = +this.svg.width || 0;
          var height = +this.svg.height || 0;
          if (wrapperWidth === width && wrapperHeight === height)
              return;
          this.svg.setAttribute("width", "" + wrapperWidth);
          this.svg.setAttribute("height", "" + wrapperHeight);
      };
      Chart.prototype.onDataChange = function () {
          this.t.domain(this.dataTable.getTimeExtent());
          if (this.x.name)
              this.x.scale.domain(this.dataTable.getExtent(this.x.name, 0.05));
          if (this.y.name)
              this.y.scale.domain(this.dataTable.getExtent(this.y.name, 0.05));
          if (this.r.name)
              this.r.scale.domain(this.dataTable.getExtent(this.r.name, 0));
          if (this.c.name)
              this.c.scale.domain(this.dataTable.getExtent(this.c.name, 0.05).reverse());
          this.triggerUpdate(true);
      };
      Chart.prototype.onScreenChange = function () {
          var xBoxplotSize = this.shouldDrawXBoxPlot() ? CFG.BOXPLOT_SIZE : 0;
          var yBoxplotSize = this.shouldDrawYBoxPlot() ? CFG.BOXPLOT_SIZE : 0;
          var marginTop = CFG.MARGIN_T;
          var marginLeft = CFG.MARGIN_L;
          var root = d3.select(this.svg).select(".root");
          root.attr("transform", "translate(" + (marginLeft + yBoxplotSize) + ", " + marginTop + ")");
          var w = +(this.svg.getAttribute("width") || 0) - marginLeft - yBoxplotSize - CFG.MARGIN_R;
          var h = +(this.svg.getAttribute("height") || 0) - marginTop - xBoxplotSize - CFG.MARGIN_B;
          this.x.scale.rangeRound([0, w]);
          this.y.scale.rangeRound([h, 0]);
          this.r.scale.rangeRound([
              CFG.DATA_CIRCLE_MIN_R,
              CFG.DATA_CIRCLE_MIN_R + Math.min(w, h) * CFG.DATA_CIRCLE_MAX_R_RATIO,
          ]);
          this.triggerUpdate(false);
      };
      Chart.prototype.startUpdater = function () {
          var _this = this;
          requestAnimationFrame(function () { return _this.startUpdater(); });
          if (!this.needUpdate)
              return;
          var now = Date.now();
          if (now - this.lastUpdate < 10)
              return;
          this.lastUpdate = now;
          this.needUpdate = false;
          this.renderAxis(this.animateUpdate);
          this.renderDataPoints(this.animateUpdate);
      };
      Chart.prototype.triggerUpdate = function (animate) {
          this.needUpdate = true;
          this.animateUpdate = animate;
      };
      Chart.prototype.renderAxis = function (animate) {
          var root = d3.select(this.svg).select(".root");
          var width = this.x.scale.range()[1];
          var height = this.y.scale.range()[0];
          var bg = root.select(".canvas-bg");
          if (animate)
              bg = bg.transition();
          bg
              .attr("width", width)
              .attr("height", height)
              .attr("fill", CFG.CANVAS_FILL_COLOR)
              .attr("stroke", CFG.CANVAS_STROKE_COLOR);
          var tickFormat = d3.format(".3s");
          // X axis
          var xAxis = d3.axisBottom(this.x.scale)
              .tickFormat(tickFormat)
              .ticks(width / CFG.GRID_PIXELS_PER_TICK)
              .tickPadding(0);
          var x = root.select(".axis-x");
          if (animate)
              x = x.transition();
          x
              .attr("transform", "translate(0, " + height + ")")
              .call(this.getCustomXAxisRenderer(xAxis, this.x, height));
          // Y axis
          var yAxis = d3.axisLeft(this.y.scale)
              .tickFormat(tickFormat)
              .ticks(height / CFG.GRID_PIXELS_PER_TICK)
              .tickPadding(0);
          var y = root.select(".axis-y");
          if (animate)
              y = y.transition();
          y.call(this.getCustomYAxisRenderer(yAxis, this.y, width));
          // Boxplots
          var boxPlotX = root.select(".boxplot-x");
          if (animate)
              boxPlotX = boxPlotX.transition();
          boxPlotX.attr("transform", "translate(0, " + (height + CFG.BOXPLOT_PADDING) + ")");
          var boxPlotY = root.select(".boxplot-y");
          if (animate)
              boxPlotY = boxPlotY.transition();
          boxPlotY.attr("transform", "translate(" + -CFG.BOXPLOT_SIZE + ", 0)");
      };
      Chart.prototype.getCustomXAxisRenderer = function (original, dim, height) {
          return function (g) {
              var isTransition = !!g.selection;
              var s = (isTransition ? g.selection() : g);
              // Remove all ticks if the scale is constant
              if (dim.isConstant()) {
                  s.selectAll(".tick").remove();
                  return;
              }
              // Remove old label
              s.selectAll(".tick .label").remove();
              // Update ticks
              g.call(original.tickSize(-height));
              s.select(".domain").remove();
              s.selectAll(".tick line")
                  .attr("stroke", CFG.GRID_STROKE_COLOR)
                  .attr("opacity", CFG.GRID_STROKE_OPACITY);
              s.selectAll(".tick text")
                  .attr("fill", CFG.AXIS_TICK_VALUE_COLOR)
                  .attr("text-anchor", "end")
                  .attr("dx", -2)
                  .attr("dy", -4);
              // Append new label
              s.select(".tick:last-child").append("text")
                  .attr("class", "label")
                  .attr("fill", CFG.AXIS_TICK_LABEL_COLOR)
                  .attr("text-anchor", "end")
                  .attr("dx", -2)
                  .attr("dy", -24)
                  .text(dim.label);
              // Cancel original tweens
              if (isTransition) {
                  g.selectAll(".tick text")
                      .attrTween("dx", null)
                      .attrTween("dy", null);
              }
          };
      };
      Chart.prototype.getCustomYAxisRenderer = function (original, dim, width) {
          return function (g) {
              var isTransition = !!g.selection;
              var s = (isTransition ? g.selection() : g);
              // Remove all ticks if the scale is constant
              if (dim.isConstant()) {
                  s.selectAll(".tick").remove();
                  return;
              }
              // Remove old label
              s.selectAll(".tick .label").remove();
              // Update ticks
              g.call(original.tickSize(-width));
              s.select(".domain").remove();
              s.selectAll(".tick line")
                  .attr("stroke", CFG.GRID_STROKE_COLOR)
                  .attr("opacity", CFG.GRID_STROKE_OPACITY);
              s.selectAll(".tick text")
                  .attr("fill", CFG.AXIS_TICK_VALUE_COLOR)
                  .attr("text-anchor", "start")
                  .attr("dx", 4)
                  .attr("dy", -4);
              // Append new label
              s.select(".tick:last-child").append("text")
                  .attr("class", "label")
                  .attr("fill", CFG.AXIS_TICK_LABEL_COLOR)
                  .attr("text-anchor", "start")
                  .attr("dx", 32)
                  .attr("dy", -4)
                  .text(dim.label);
              // Cancel original tweens
              if (isTransition) {
                  g.selectAll(".tick text")
                      .attrTween("dx", null)
                      .attrTween("dy", null);
              }
          };
      };
      Chart.prototype.renderDataPoints = function (animate) {
          var _this = this;
          if (this.currentTime === undefined)
              return;
          var data = this.dataTable.getValuesAt(this.currentTime);
          var key = this.dataTable.getCategoryColumn().name;
          var root = d3.select(this.svg).select(".root");
          var dpUpdate = root.select(".canvas")
              .selectAll(".datapoint")
              .data(data, function (d) { return d[key]; });
          var dpExit = dpUpdate.exit();
          if (animate)
              dpExit = dpExit.transition();
          dpExit
              .style("opacity", 0)
              .select("circle")
              .attr("r", 0)
              .select(function () {
              return this.parentNode;
          })
              .remove();
          var dpMerged = dpUpdate.enter()
              .append("g")
              .attr("class", "datapoint")
              .attr("transform", function (d) { return "translate(" + _this.x.scaled(d) + ", " + _this.y.scaled(d) + ")"; })
              .style("opacity", 0)
              .each(function () {
              d3.select(this)
                  .append("circle")
                  .attr("r", 0)
                  .attr("stroke", CFG.DATA_CIRCLE_STROKE)
                  .attr("stroke-width", 0.5)
                  .style("shape-rendering", "geometricPrecision");
          })
              .merge(dpUpdate);
          if (animate)
              dpMerged = dpMerged.transition();
          dpMerged
              .attr("transform", function (d) { return "translate(" + _this.x.scaled(d) + ", " + _this.y.scaled(d) + ")"; })
              .style("opacity", CFG.DATA_CIRCLE_OPACITY)
              .select("circle")
              .attr("r", function (d) { return _this.r.scaled(d); })
              .attr("fill", function (d) { return _this.c.isConstant() ? CFG.DATA_CIRCLE_DEFAULT_FILL : _this.c.scaled(d); });
          if (this.shouldDrawXBoxPlot())
              this.renderBoxplot(data, this.x, root.select(".boxplot-x"), true, animate);
          if (this.shouldDrawYBoxPlot())
              this.renderBoxplot(data, this.y, root.select(".boxplot-y"), false, animate);
      };
      Chart.prototype.renderBoxplot = function (data, dim, root, isx, animate) {
          // Prepare data
          var values = data.map(function (d) { return dim.raw(d); });
          var fiveNums = [0, .25, .5, .75, 1].map(function (d) { return d3.quantile(values.sort(d3.ascending), d); });
          var iqr = fiveNums[3] - fiveNums[1];
          var inside = [
              d3.min(values.filter(function (d) { return fiveNums[1] - iqr * 1.5 <= d; })) || 0,
              d3.max(values.filter(function (d) { return fiveNums[3] + iqr * 1.5 >= d; })) || 0,
          ];
          // Render
          var size = CFG.BOXPLOT_SIZE;
          var pad = CFG.BOXPLOT_PADDING;
          if (root.html() === "") {
              var clipId_1 = "boxplot-clip-" + (isx ? "x" : "y");
              root.append("g")
                  .attr("class", "plot")
                  .each(function () {
                  var thisSel = d3.select(this);
                  thisSel.append("clipPath")
                      .attr("id", clipId_1).append("rect");
                  thisSel.append("path")
                      .attr("class", "whisker")
                      .attr("stroke-width", 0.5)
                      .attr("clip-path", "url(#" + clipId_1 + ")");
                  thisSel.append("rect")
                      .attr("class", "box")
                      .attr("stroke-width", 0.5)
                      .attr("clip-path", "url(#" + clipId_1 + ")");
                  thisSel.append("line")
                      .attr("class", "median")
                      .attr("stroke-width", 0.5)
                      .attr("clip-path", "url(#" + clipId_1 + ")");
              });
              root.append("g")
                  .attr("class", "data")
                  .attr("transform", isx ? "translate(0, " + size * .5 + ")" : "translate(" + size * .5 + ", 0)");
          }
          // 1. Clip
          var clip = root.select("clipPath rect");
          if (animate)
              clip = clip.transition();
          clip
              .attr("x", 0)
              .attr("y", 0)
              .attr(isx ? "width" : "height", dim.scale.range()[isx ? 1 : 0])
              .attr(isx ? "height" : "width", size);
          // 2. Box
          var box = root.select(".box");
          if (animate)
              box = box.transition();
          box
              .attr(isx ? "x" : "y", dim.scale(fiveNums[isx ? 1 : 3]))
              .attr(isx ? "width" : "height", Math.abs(dim.scale(fiveNums[3]) - dim.scale(fiveNums[1])))
              .attr(isx ? "y" : "x", pad)
              .attr(isx ? "height" : "width", size - pad * 2)
              .attr("fill", "#FFFFFF")
              .attr("stroke", CFG.BOXPLOT_STROKE_COLOR);
          // 3. Whisker
          var whisker = root.select(".whisker");
          if (animate)
              whisker = whisker.transition();
          var whiskerPath = isx ?
              "\n        M" + dim.scale(inside[0]) + "," + pad + " l0," + (size - pad * 2) + "\n        m0,-" + (size * 0.5 - pad) + " l" + (dim.scale(inside[1]) - dim.scale(inside[0])) + ",0\n        m0,-" + (size * 0.5 - pad) + " l0," + (size - pad * 2) + "\n      " :
              "\n        M" + pad + "," + dim.scale(inside[0]) + " l" + (size - pad * 2) + ",0\n        m-" + (size * 0.5 - pad) + ",0 l0,-" + (dim.scale(inside[0]) - dim.scale(inside[1])) + "\n        m-" + (size * 0.5 - pad) + ",0 l" + (size - pad * 2) + ",0\n      ";
          whisker
              .attr("d", whiskerPath)
              .attr("stroke", CFG.BOXPLOT_STROKE_COLOR);
          // 4. Median bar
          var median = root.select(".median");
          if (animate)
              median = median.transition();
          median
              .attr(isx ? "x1" : "y1", dim.scale(fiveNums[2]))
              .attr(isx ? "x2" : "y2", dim.scale(fiveNums[2]))
              .attr(isx ? "y1" : "x1", pad)
              .attr(isx ? "y2" : "x2", size - pad)
              .attr("stroke", CFG.BOXPLOT_STROKE_COLOR);
          // 5. Dots
          var key = this.dataTable.getCategoryColumn().name;
          var dotUpdate = root.select(".data")
              .selectAll("circle")
              .data(data, function (d) { return d[key]; });
          var dotExit = dotUpdate.exit();
          if (animate)
              dotExit = dotExit.transition();
          dotExit
              .attr("opacity", 0)
              .attr("r", 0)
              .remove();
          var dotMerged = dotUpdate.enter()
              .append("circle")
              .attr(isx ? "cx" : "cy", function (d) { return dim.scaled(d); })
              .attr("shape-rendering", "geometricPrecision")
              .attr("r", 0)
              .attr("opacity", 0)
              .attr("fill", CFG.BOXPLOT_POINT_FILL_COLOR)
              .merge(dotUpdate);
          if (animate)
              dotMerged = dotMerged.transition();
          dotMerged
              .attr(isx ? "cx" : "cy", function (d) { return dim.scaled(d); })
              .attr("r", function (d) { return isInRange(dim.raw(d), inside) ? CFG.BOXPLOT_DOT_R : CFG.BOXPLOT_OUTLIER_R; })
              .attr("opacity", function (d) { return isInRange(dim.raw(d), inside) ? CFG.BOXPLOT_DOT_OPACITY : CFG.BOXPLOT_OUTLIER_OPACITY; });
      };
      Chart.prototype.shouldDrawXBoxPlot = function () {
          return !!this.options.xBoxPlot && !this.x.isConstant();
      };
      Chart.prototype.shouldDrawYBoxPlot = function () {
          return !!this.options.yBoxPlot && !this.y.isConstant();
      };
      return Chart;
  }());
  function constantScale() {
      var domainValue = [0, 1];
      var rangeValue = [0, 1];
      var scale = function () {
          return (rangeValue[0] + rangeValue[1]) * 0.5;
      };
      scale.constant = true;
      scale.domain = function (value) {
          if (!value)
              return domainValue;
          domainValue = value;
          return scale;
      };
      scale.range = function (value) {
          if (!value)
              return rangeValue;
          rangeValue = value;
          return scale;
      };
      scale.rangeRound = function (value) {
          if (!value)
              return rangeValue;
          rangeValue = value;
          return scale;
      };
      scale.copy = function () {
          return scale;
      };
      return scale;
  }

  var DataTable = /** @class */ (function () {
      function DataTable(columnTypes, data) {
          this.columnTypes = columnTypes;
          this.columnMap = d3.map(this.columnTypes, function (d) { return d.name; });
          this.data = data;
          // Detect category column
          var categoryColumn = find(this.columnTypes, function (d) { return d.type === "string"; });
          if (categoryColumn === undefined)
              throw new Error("columnTypes should have at least one string field");
          this.categoryColumn = categoryColumn;
          // Detect time column
          var timeColumn = find(this.columnTypes, function (d) { return d.type === "number"; });
          if (timeColumn === undefined)
              throw new Error("columnTypes should have at least one number field");
          this.timeColumn = timeColumn;
          // Create linear scale for each column
          var categoryColumnName = this.categoryColumn.name;
          var timeColumnName = this.timeColumn.name;
          var nestedData = d3.nest()
              .key(function (d) { return "" + d[categoryColumnName]; })
              .entries(this.data);
          this.scales = nestedData.map(function (kv) {
              return d3.scaleLinear()
                  .domain(kv.values.map(function (v) { return v[timeColumnName]; }))
                  .range(kv.values);
          });
      }
      DataTable.prototype.getCategoryColumn = function () {
          return this.categoryColumn;
      };
      DataTable.prototype.getTimeColumn = function () {
          return this.timeColumn;
      };
      DataTable.prototype.getColumnType = function (name) {
          var columnType = this.columnMap.get(name);
          if (!columnType)
              throw new Error("Unknown column name: " + name);
          return columnType;
      };
      /**
       * Returns [min, max] of specified column
       */
      DataTable.prototype.getExtent = function (key, paddingRatio) {
          if (paddingRatio === void 0) { paddingRatio = 0.0; }
          if (!this.columnMap.has(key))
              throw new Error("Unknown column name: " + key);
          var extent = d3.extent(this.data, function (d) { return +d[key]; });
          if (paddingRatio === 0.0)
              return extent;
          var pad = (extent[1] - extent[0]) * paddingRatio;
          return [extent[0] - pad, extent[1] + pad];
      };
      DataTable.prototype.getTimeExtent = function () {
          return this.getExtent(this.timeColumn.name);
      };
      /**
       * Returns unique time values in data
       */
      DataTable.prototype.getTimeValues = function () {
          var _this = this;
          return d3.set(this.data.map(function (d) { return d[_this.timeColumn.name]; }))
              .values()
              .map(function (d) { return +d; })
              .sort(d3.ascending);
      };
      /**
       * Returns interpolated values at specific time
       */
      DataTable.prototype.getValuesAt = function (time) {
          return this.scales.map(function (s) { return s(time); });
      };
      return DataTable;
  }());

  var index = {
      DataTable: DataTable,
      Chart: Chart,
  };

  return index;

}(d3));
//# sourceMappingURL=motionchart.js.map
