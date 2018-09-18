import * as d3 from "d3"
import {DataTable, IDatum} from "./DataTable"
import {Dimension} from "./Dimension"
import {haloEffect, isInRange} from "./Utils"

const CFG = {
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
}

type num = number
type bool = boolean
type str = string

type Selection<D extends IDatum> = d3.Selection<any, D, any, undefined>
type SelectionOrTransition<D extends IDatum> = d3.SelectionOrTransition<any, D, any, undefined>

export interface IChartOptions {
  xBoxPlot?: bool
  yBoxPlot?: bool
}

export class Chart<D extends IDatum> {
  private readonly element: HTMLElement
  private readonly svg: SVGSVGElement

  private readonly dataTable: DataTable<D>
  private readonly options: IChartOptions

  private readonly t: d3.ScaleTime<num, num>
  private x: Dimension<D>
  private y: Dimension<D>
  private r: Dimension<D>
  private c: Dimension<D>

  private currentTime: num | undefined

  private lastUpdate: num
  private needUpdate: bool
  private animateUpdate: bool

  constructor(
    dataTable: DataTable<D>, element: HTMLElement,
    options: IChartOptions,
  ) {
    if (element.innerHTML.trim()) throw new Error("element is not empty")

    this.dataTable = dataTable

    this.options = options

    this.lastUpdate = 0
    this.needUpdate = false
    this.animateUpdate = false

    this.x = this.createDim("x", "", "constant")
    this.y = this.createDim("y", "", "constant")
    this.r = this.createDim("r", "", "constant")
    this.c = this.createDim("c", "", "constant")
    this.t = d3.scaleTime()

    // Initialize internal elements
    this.element = element
    this.element.innerHTML = `
      <span style="display: block; width: 100%; height: 100%; padding: 0; border: 0; margin: 0; overflow: hidden;">
        <svg style="display: block; padding: 0; margin: 0; border: 0; shape-rendering: crispEdges;">
          <g class="root">
            <rect class="canvas-bg" x="0" y="0" width="0" height="0" />
            <g class="axis axis-x"></g>
            <g class="axis axis-y"></g>
            <g class="boxplot boxplot-x"></g>
            <g class="boxplot boxplot-y"></g>
            <g class="canvas"></g>
          </g>
        </svg>
      </span>
    `

    const wrapper = this.element.firstElementChild as HTMLSpanElement
    this.svg = wrapper.firstElementChild as SVGSVGElement

    this.fit()
    this.onDataChange()
    this.onScreenChange()
    this.setProgress(0.0, true)

    // Register resize handler
    const window = this.element.ownerDocument.defaultView
    window.addEventListener("resize", () => {
      this.fit()
      this.onScreenChange()
    })

    this.triggerUpdate(false)
    this.startUpdater()
  }

  public setProgress(rate: num, animate: bool): void {
    const extent = this.t.domain()
    const min = +extent[0]
    const max = +extent[1]
    const newTime = (max - min) * rate + min
    if (this.currentTime === newTime) return

    this.currentTime = newTime
    this.triggerUpdate(animate)
  }

  public setX(colName: str, scaleName: str, options?: any): void {
    this.x = this.createDim("x", colName, scaleName, options)
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public unsetX(): void {
    this.x = this.createDim("x", "", "constant")
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public setY(colName: str, scaleName: str, options?: any): void {
    this.y = this.createDim("y", colName, scaleName, options)
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public unsetY(): void {
    this.y = this.createDim("y", "", "constant")
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public setR(colName: str, scaleName: str, options?: any): void {
    this.r = this.createDim("r", colName, scaleName, options)
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public unsetR(): void {
    this.r = this.createDim("r", "", "constant")
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public setC(colName: str, scaleName: str, options?: any): void {
    this.c = this.createDim("c", colName, scaleName, options)
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  public unsetC(): void {
    this.c = this.createDim("c", "", "constant")
    this.onDataChange()
    this.onScreenChange()
    this.triggerUpdate(true)
  }

  private createDim(dimName: str, colName: str, scaleName: str, options?: any): Dimension<D> {
    if (["x", "y", "r", "c"].indexOf(dimName) === -1)
      throw new Error(`Invalid dimension: ${dimName}`)
    if (["constant", "linear", "sqrt", "sequential", "categorical"].indexOf(scaleName) === -1)
      throw new Error(`Invalid scale: ${scaleName}`)
    if (scaleName === "constant")
      return new Dimension("", "", d => d[colName] as num, constantScale<D>())

    const columnType = this.dataTable.getColumnType(colName)
    options = options || {}

    const validMappings = [
      ["x", "linear", "number", () => d3.scaleLinear<D>()],
      ["y", "linear", "number", () => d3.scaleLinear<D>()],
      ["r", "linear", "number", () => d3.scaleLinear<D>()],
      ["r", "sqrt", "number", () => d3.scaleSqrt<D>()],
      ["c", "sequential", "number", () => d3.scaleSequential(d3.interpolateViridis)],
      ["c", "categorical", "string", () => d3.scaleOrdinal(d3.schemePaired)],
    ]

    const maps = validMappings
      .filter(m => m[0] === dimName && m[1] === scaleName && m[2] === columnType.type)
    if (!maps.length)
      throw new Error(`Incompatible dimension "${dimName}", scale "${scaleName}", and type "${columnType.type}"`)
    const scaleFactory = maps[0][3] as () => any
    const scale = scaleFactory()
    return new Dimension(columnType.label, columnType.name, d => d[colName] as num, scale)
  }

  /**
   * Change size of SVG to fill outer element
   */
  private fit(): void {
    const wrapper = this.element.firstElementChild as HTMLSpanElement
    const wrapperWidth = wrapper.clientWidth
    const wrapperHeight = wrapper.clientHeight

    const width = +this.svg.width || 0
    const height = +this.svg.height || 0

    if (wrapperWidth === width && wrapperHeight === height) return
    this.svg.setAttribute("width", "" + wrapperWidth)
    this.svg.setAttribute("height", "" + wrapperHeight)
  }

  private onDataChange(): void {
    this.t.domain(this.dataTable.getTimeExtent())

    if (this.x.name)
      this.x.scale.domain(this.dataTable.getExtent(this.x.name, 0.05))
    if (this.y.name)
      this.y.scale.domain(this.dataTable.getExtent(this.y.name, 0.05))
    if (this.r.name)
      this.r.scale.domain(this.dataTable.getExtent(this.r.name, 0))
    if (this.c.name)
      this.c.scale.domain(this.dataTable.getExtent(this.c.name, 0.05).reverse())

    this.triggerUpdate(true)
  }

  private onScreenChange(): void {
    const xBoxplotSize = this.shouldDrawXBoxPlot() ? CFG.BOXPLOT_SIZE : 0
    const yBoxplotSize = this.shouldDrawYBoxPlot() ? CFG.BOXPLOT_SIZE : 0
    const marginTop = CFG.MARGIN_T
    const marginLeft = CFG.MARGIN_L

    const root = d3.select(this.svg).select(".root")
    root.attr("transform", `translate(${marginLeft + yBoxplotSize}, ${marginTop})`)

    const w = +(this.svg.getAttribute("width") || 0) - marginLeft - yBoxplotSize - CFG.MARGIN_R
    const h = +(this.svg.getAttribute("height") || 0) - marginTop - xBoxplotSize - CFG.MARGIN_B

    this.x.scale.rangeRound([0, w])
    this.y.scale.rangeRound([h, 0])
    this.r.scale.rangeRound([
      CFG.DATA_CIRCLE_MIN_R,
      CFG.DATA_CIRCLE_MIN_R + Math.min(w, h) * CFG.DATA_CIRCLE_MAX_R_RATIO,
    ])

    this.triggerUpdate(false)
  }

  private startUpdater(): void {
    requestAnimationFrame(() => this.startUpdater())

    if (!this.needUpdate) return

    const now = Date.now()
    if (now - this.lastUpdate < 10) return

    this.lastUpdate = now
    this.needUpdate = false

    this.renderAxis(this.animateUpdate)
    this.renderDataPoints(this.animateUpdate)
  }

  private triggerUpdate(animate: bool): void {
    this.needUpdate = true
    this.animateUpdate = animate
  }

  private renderAxis(animate: bool): void {
    const root = d3.select(this.svg).select(".root")
    const width = this.x.scale.range()[1]
    const height = this.y.scale.range()[0]

    let bg: any = root.select(".canvas-bg")
    if (animate) bg = bg.transition()
    bg
      .attr("width", width)
      .attr("height", height)
      .attr("fill", CFG.CANVAS_FILL_COLOR)
      .attr("stroke", CFG.CANVAS_STROKE_COLOR)

    const tickFormat = d3.format(".3s")

    // X axis
    const xAxis = d3.axisBottom<num>(this.x.scale)
      .tickFormat(tickFormat)
      .ticks(width / CFG.GRID_PIXELS_PER_TICK)
      .tickPadding(0)

    let x: any = root.select(".axis-x")
    if (animate) x = x.transition()
    x
      .attr("transform", `translate(0, ${height})`)
      .call(this.getCustomXAxisRenderer(xAxis, this.x, height))

    // Y axis
    const yAxis = d3.axisLeft<num>(this.y.scale)
      .tickFormat(tickFormat)
      .ticks(height / CFG.GRID_PIXELS_PER_TICK)
      .tickPadding(0)

    let y: any = root.select(".axis-y")
    if (animate) y = y.transition()
    y.call(this.getCustomYAxisRenderer(yAxis, this.y, width))

    // Boxplots
    let boxPlotX: any = root.select(".boxplot-x")
    if (animate) boxPlotX = boxPlotX.transition()
    boxPlotX.attr("transform", `translate(0, ${height + CFG.BOXPLOT_PADDING})`)

    let boxPlotY: any = root.select(".boxplot-y")
    if (animate) boxPlotY = boxPlotY.transition()
    boxPlotY.attr("transform", `translate(${-CFG.BOXPLOT_SIZE}, 0)`)
  }

  private getCustomXAxisRenderer(original: d3.Axis<num>, dim: Dimension<D>, height: num): (g: any) => void {
    return (g: any) => {
      const isTransition = !!g.selection
      const s = (isTransition ? g.selection() : g) as Selection<D>

      // Remove all ticks if the scale is constant
      if (dim.isConstant()) {
        s.selectAll(".tick").remove()
        return
      }

      // Remove old label
      s.selectAll(".tick .label").remove()

      // Update ticks
      g.call(original.tickSize(-height))
      s.select(".domain").remove()
      s.selectAll(".tick line")
        .attr("stroke", CFG.GRID_STROKE_COLOR)
        .attr("opacity", CFG.GRID_STROKE_OPACITY)
      s.selectAll(".tick text")
        .attr("fill", CFG.AXIS_TICK_VALUE_COLOR)
        .attr("text-anchor", "end")
        .attr("dx", -2)
        .attr("dy", -4)

      // Append new label
      s.select(".tick:last-child").append("text")
        .attr("class", "label")
        .attr("fill", CFG.AXIS_TICK_LABEL_COLOR)
        .attr("text-anchor", "end")
        .attr("dx", -2)
        .attr("dy", -24)
        .text(dim.label)

      // Cancel original tweens
      if (isTransition) {
        g.selectAll(".tick text")
          .attrTween("dx", null)
          .attrTween("dy", null)
      }
    }
  }

  private getCustomYAxisRenderer(original: d3.Axis<num>, dim: Dimension<D>, width: num): (g: any) => void {
    return (g: any) => {
      const isTransition = !!g.selection
      const s = (isTransition ? g.selection() : g) as Selection<D>

      // Remove all ticks if the scale is constant
      if (dim.isConstant()) {
        s.selectAll(".tick").remove()
        return
      }

      // Remove old label
      s.selectAll(".tick .label").remove()

      // Update ticks
      g.call(original.tickSize(-width))
      s.select(".domain").remove()
      s.selectAll(".tick line")
        .attr("stroke", CFG.GRID_STROKE_COLOR)
        .attr("opacity", CFG.GRID_STROKE_OPACITY)
      s.selectAll(".tick text")
        .attr("fill", CFG.AXIS_TICK_VALUE_COLOR)
        .attr("text-anchor", "start")
        .attr("dx", 4)
        .attr("dy", -4)

      // Append new label
      s.select(".tick:last-child").append("text")
        .attr("class", "label")
        .attr("fill", CFG.AXIS_TICK_LABEL_COLOR)
        .attr("text-anchor", "start")
        .attr("dx", 32)
        .attr("dy", -4)
        .text(dim.label)

      // Cancel original tweens
      if (isTransition) {
        g.selectAll(".tick text")
          .attrTween("dx", null)
          .attrTween("dy", null)
      }
    }
  }

  private renderDataPoints(animate: bool): void {
    if (this.currentTime === undefined) return

    const data = this.dataTable.getValuesAt(this.currentTime)
    const key = this.dataTable.getCategoryColumn().name

    const root = d3.select(this.svg).select(".root")
    const dpUpdate = root.select(".canvas")
      .selectAll(".datapoint")
      .data(data, (d: any) => d[key])

    let dpExit: any = dpUpdate.exit()
    if (animate) dpExit = dpExit.transition()
    dpExit
      .style("opacity", 0)
      .select("circle")
      .attr("r", 0)
      .select(function (this: SVGElement) {
        return this.parentNode
      })
      .remove()

    let dpMerged: any = dpUpdate.enter()
      .append("g")
      .attr("class", "datapoint")
      .attr(
        "transform",
        d => `translate(${this.x.scaled(d)}, ${this.y.scaled(d)})`,
      )
      .style("opacity", 0)
      .each(function (d) {
        d3.select(this)
          .append("circle")
          .attr("r", 0)
          .attr("stroke", CFG.DATA_CIRCLE_STROKE)
          .attr("stroke-width", 0.5)
          .style("shape-rendering", "geometricPrecision")
        d3.select(this)
          .append("text")
          .attr("font-family", "sans-serif")
          .attr("font-size", "11")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("opacity", 0.0)
          .style("cursor", "default")
          .text("" + d[key])
          .call(haloEffect)
      })
      .on("mouseover", function () {
        d3.select(this)
          .raise()
          .selectAll("text").attr("opacity", 1.0)
      })
      .on("mouseout", function () {
        d3.select(this).selectAll("text").attr("opacity", 0.0)
      })
      .merge(dpUpdate)

    if (animate) dpMerged = dpMerged.transition()
    dpMerged
      .attr(
        "transform",
        (d: D) => `translate(${this.x.scaled(d)}, ${this.y.scaled(d)})`)
      .style("opacity", CFG.DATA_CIRCLE_OPACITY)
      .select("circle")
      .attr("r", (d: D) => this.r.scaled(d))
      .attr("fill", (d: D) => this.c.isConstant() ? CFG.DATA_CIRCLE_DEFAULT_FILL : this.c.scaled(d))

    if (this.shouldDrawXBoxPlot())
      this.renderBoxplot(data, this.x, root.select(".boxplot-x"), true, animate)
    if (this.shouldDrawYBoxPlot())
      this.renderBoxplot(data, this.y, root.select(".boxplot-y"), false, animate)
  }

  private renderBoxplot(
    data: D[], dim: Dimension<D>, root: Selection<any>, isx: bool, animate: bool,
  ): void {
    // Prepare data
    const values = data.map(d => dim.raw(d))
    const fiveNums = [0, .25, .5, .75, 1].map(d => d3.quantile(values.sort(d3.ascending), d))
    const iqr = (fiveNums[3] as num) - (fiveNums[1] as num)
    const inside: [num, num] = [
      d3.min(values.filter(d => (fiveNums[1] as num) - iqr * 1.5 <= d)) || 0,
      d3.max(values.filter(d => (fiveNums[3] as num) + iqr * 1.5 >= d)) || 0,
    ]

    // Render
    const size = CFG.BOXPLOT_SIZE
    const pad = CFG.BOXPLOT_PADDING

    if (root.html() === "") {
      const clipId = `boxplot-clip-${isx ? "x" : "y"}`
      root.append("g")
        .attr("class", "plot")
        .each(function () {
          const thisSel = d3.select(this)
          thisSel.append("clipPath")
            .attr("id", clipId).append("rect")
          thisSel.append("path")
            .attr("class", "whisker")
            .attr("stroke-width", 0.5)
            .attr("clip-path", `url(#${clipId})`)
          thisSel.append("rect")
            .attr("class", "box")
            .attr("stroke-width", 0.5)
            .attr("clip-path", `url(#${clipId})`)
          thisSel.append("line")
            .attr("class", "median")
            .attr("stroke-width", 0.5)
            .attr("clip-path", `url(#${clipId})`)
        })
      root.append("g")
        .attr("class", "data")
        .attr("transform", isx ? `translate(0, ${size * .5})` : `translate(${size * .5}, 0)`)
    }

    // 1. Clip
    let clip: SelectionOrTransition<D> = root.select("clipPath rect")
    if (animate) clip = clip.transition()
    clip
      .attr("x", 0)
      .attr("y", 0)
      .attr(isx ? "width" : "height", dim.scale.range()[isx ? 1 : 0])
      .attr(isx ? "height" : "width", size)

    // 2. Box
    let box: SelectionOrTransition<D> = root.select(".box")
    if (animate) box = box.transition()
    box
      .attr(isx ? "x" : "y", dim.scale(fiveNums[isx ? 1 : 3] as num))
      .attr(isx ? "width" : "height", Math.abs(dim.scale(fiveNums[3] as num) - dim.scale(fiveNums[1] as num)))
      .attr(isx ? "y" : "x", pad)
      .attr(isx ? "height" : "width", size - pad * 2)
      .attr("fill", "#FFFFFF")
      .attr("stroke", CFG.BOXPLOT_STROKE_COLOR)

    // 3. Whisker
    let whisker: SelectionOrTransition<D> = root.select(".whisker")
    if (animate) whisker = whisker.transition()
    const whiskerPath = isx ?
      `
        M${dim.scale(inside[0])},${pad} l0,${size - pad * 2}
        m0,-${size * 0.5 - pad} l${dim.scale(inside[1]) - dim.scale(inside[0])},0
        m0,-${size * 0.5 - pad} l0,${size - pad * 2}
      ` :
      `
        M${pad},${dim.scale(inside[0])} l${size - pad * 2},0
        m-${size * 0.5 - pad},0 l0,-${dim.scale(inside[0]) - dim.scale(inside[1])}
        m-${size * 0.5 - pad},0 l${size - pad * 2},0
      `
    whisker
      .attr("d", whiskerPath)
      .attr("stroke", CFG.BOXPLOT_STROKE_COLOR)

    // 4. Median bar
    let median: SelectionOrTransition<D> = root.select(".median")
    if (animate) median = median.transition()
    median
      .attr(isx ? "x1" : "y1", dim.scale(fiveNums[2] as num))
      .attr(isx ? "x2" : "y2", dim.scale(fiveNums[2] as num))
      .attr(isx ? "y1" : "x1", pad)
      .attr(isx ? "y2" : "x2", size - pad)
      .attr("stroke", CFG.BOXPLOT_STROKE_COLOR)

    // 5. Dots
    const key = this.dataTable.getCategoryColumn().name
    const dotUpdate: Selection<D> = root.select(".data")
      .selectAll("circle")
      .data<D>(data, (d: any) => d[key])

    let dotExit: SelectionOrTransition<D> = dotUpdate.exit()
    if (animate) dotExit = dotExit.transition()
    dotExit
      .attr("opacity", 0)
      .attr("r", 0)
      .remove()

    let dotMerged: SelectionOrTransition<D> = dotUpdate.enter()
      .append("circle")
      .attr(isx ? "cx" : "cy", d => dim.scaled(d))
      .attr("shape-rendering", "geometricPrecision")
      .attr("r", 0)
      .attr("opacity", 0)
      .attr("fill", CFG.BOXPLOT_POINT_FILL_COLOR)
      .merge(dotUpdate)
    if (animate) dotMerged = dotMerged.transition()
    dotMerged
      .attr(isx ? "cx" : "cy", d => dim.scaled(d))
      .attr("r", d => isInRange(dim.raw(d), inside) ? CFG.BOXPLOT_DOT_R : CFG.BOXPLOT_OUTLIER_R)
      .attr("opacity", d => isInRange(dim.raw(d), inside) ? CFG.BOXPLOT_DOT_OPACITY : CFG.BOXPLOT_OUTLIER_OPACITY)
  }

  private shouldDrawXBoxPlot(): bool {
    return !!this.options.xBoxPlot && !this.x.isConstant()
  }

  private shouldDrawYBoxPlot(): bool {
    return !!this.options.yBoxPlot && !this.y.isConstant()
  }
}

function constantScale<D extends IDatum>() {
  let domainValue = [0, 1]
  let rangeValue = [0, 1]

  const scale: any = (): number => {
    return (rangeValue[0] + rangeValue[1]) * 0.5
  }

  scale.constant = true

  scale.domain = (value?: [number, number]) => {
    if (!value) return domainValue
    domainValue = value
    return scale
  }

  scale.range = (value?: [number, number]) => {
    if (!value) return rangeValue
    rangeValue = value
    return scale
  }

  scale.rangeRound = (value?: [number, number]) => {
    if (!value) return rangeValue
    rangeValue = value
    return scale
  }

  scale.copy = () => {
    return scale
  }

  return scale
}
