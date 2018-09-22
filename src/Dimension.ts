import {DataTable, IDatum} from "./DataTable"

type num = number
type str = string
type bool = boolean

export interface IDimensionOptions {
  axisMin?: num
  axisMax?: num
  axisPadRatio?: num
}

export class Dimension<D extends IDatum> {
  public readonly label: str
  public readonly name: str
  public readonly scale: any
  private readonly getter: (d: D) => num
  private readonly options: IDimensionOptions

  constructor(label: str, name: str, getter: (d: D) => num, scale: any, options: IDimensionOptions) {
    this.label = label
    this.name = name
    this.getter = getter
    this.scale = scale
    this.options = options
  }

  public raw(d: D): num {
    return this.getter(d)
  }

  public scaled(d: D): num | str {
    return this.scale(this.getter(d))
  }

  public updateDomain(dataTable: DataTable<D>, reverse: boolean): void {
    let min
    let max

    if (this.options.axisMin !== undefined && this.options.axisMax !== undefined) {
      min = this.options.axisMin
      max = this.options.axisMax
    } else {
      const extent = dataTable.getExtent(this.name)
      min = this.options.axisMin || extent[0]
      max = this.options.axisMax || extent[1]
    }

    const padding = (max - min) * (this.options.axisPadRatio || 0.05)
    const domain = [min - padding, max + padding]
    this.scale.domain(reverse ? domain.reverse() : domain)
  }

  public isConstant(): bool {
    return !!this.scale.constant
  }
}
