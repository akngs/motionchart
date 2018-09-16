import * as d3 from "d3"
import {find} from "./Utils"

export interface IColumnType {
  name: string
  label: string
  type: "number" | "string"
}

export interface IDatum {
  [key: string]: number | string | null
}

export class DataTable<D extends IDatum> {
  private readonly columnTypes: IColumnType[]
  private readonly data: D[]

  private readonly categoryColumn: IColumnType
  private readonly timeColumn: IColumnType

  private readonly scales: Array<d3.ScaleLinear<number, D>>
  private readonly columnMap: d3.Map<IColumnType>

  constructor(columnTypes: IColumnType[], data: D[]) {
    this.columnTypes = columnTypes
    this.columnMap = d3.map(this.columnTypes, d => d.name)
    this.data = data

    // Detect category column
    const categoryColumn = find(this.columnTypes, (d) => d.type === "string")
    if (categoryColumn === undefined) throw new Error("columnTypes should have at least one string field")
    this.categoryColumn = categoryColumn

    // Detect time column
    const timeColumn = find(this.columnTypes, (d) => d.type === "number")
    if (timeColumn === undefined) throw new Error("columnTypes should have at least one number field")
    this.timeColumn = timeColumn

    // Create linear scale for each column
    const categoryColumnName = this.categoryColumn.name
    const timeColumnName = this.timeColumn.name
    const nestedData = d3.nest<D, undefined>()
      .key(d => "" + d[categoryColumnName])
      .entries(this.data)
    this.scales = nestedData.map(kv => {
      return d3.scaleLinear<number, D>()
        .domain(kv.values.map((v: D) => v[timeColumnName]))
        .range(kv.values)
    })
  }

  public getCategoryColumn(): IColumnType {
    return this.categoryColumn
  }

  public getTimeColumn(): IColumnType {
    return this.timeColumn
  }

  public getColumnType(name: string): IColumnType {
    const columnType = this.columnMap.get(name)
    if (!columnType) throw new Error(`Unknown column name: ${name}`)
    return columnType
  }

  /**
   * Returns [min, max] of specified column
   */
  public getExtent(key: string, paddingRatio: number = 0.0): [number, number] {
    if (!this.columnMap.has(key)) throw new Error(`Unknown column name: ${key}`)

    const extent = d3.extent<D, number>(this.data, d => +(d[key] as number))
    if (paddingRatio === 0.0) return extent as [number, number]

    const pad = ((extent[1] as number) - (extent[0] as number)) * paddingRatio
    return [(extent[0] as number) - pad, (extent[1] as number) + pad]
  }

  public getTimeExtent(): [number, number] {
    return this.getExtent(this.timeColumn.name)
  }

  /**
   * Returns unique time values in data
   */
  public getTimeValues(): number[] {
    return d3.set(this.data.map(d => d[this.timeColumn.name]) as any)
      .values()
      .map((d: any) => +d)
      .sort(d3.ascending)
  }

  /**
   * Returns interpolated values at specific time
   */
  public getValuesAt(time: number): D[] {
    return this.scales.map(s => s(time))
  }
}
