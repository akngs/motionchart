import * as d3 from "d3"
import {IDatum} from "./DataTable"

type num = number
type str = string

export class Dimension<D extends IDatum> {
  public readonly label: str
  public readonly name: str
  public readonly scale: any
  private readonly getter: (d: D) => num

  constructor(label: str, name: str, getter: (d: D) => num, scale: any) {
    this.label = label
    this.name = name
    this.getter = getter
    this.scale = scale
  }

  public raw(d: D): num {
    return this.getter(d)
  }

  public scaled(d: D): num | str {
    return this.scale(this.getter(d))
  }
}
