import {DataTable} from "../src/DataTable"

describe("DataTable", () => {
  let dataTable: DataTable<any>

  beforeEach(() => {
    dataTable = new DataTable(
      [
        {name: "key", label: "key", type: "string"},
        {name: "date", label: "date", type: "number"},
        {name: "price", label: "price", type: "number"},
      ],
      [
        {key: "A", date: 10, price: 1000},
        {key: "B", date: 10, price: 2000},
        {key: "B", date: 20, price: 1800},
        {key: "A", date: 30, price: 1500},
        {key: "B", date: 30, price: 1400},
        {key: "B", date: 40, price: 1200},
        {key: "B", date: 50, price: 1000},
      ],
    )
  })

  test("recognize first string field as category key", () => {
    expect(dataTable.getCategoryColumn())
      .toEqual({name: "key", label: "key", type: "string"})
  })

  test("recognize first number field as time key", () => {
    expect(dataTable.getTimeColumn())
      .toEqual({name: "date", label: "date", type: "number"})
  })

  test("calculate min/max range of data", () => {
    expect(dataTable.getExtent("price")).toEqual([1000, 2000])
    expect(dataTable.getExtent("date")).toEqual([10, 50])
  })

  test("collect unique time values", () => {
    expect(dataTable.getTimeValues()).toEqual([10, 20, 30, 40, 50])
  })

  test("get value at specific time", () => {
    expect(dataTable.getValuesAt(10)).toEqual([
      {key: "A", date: 10, price: 1000},
      {key: "B", date: 10, price: 2000},
    ])
  })

  test("interpolate", () => {
    expect(dataTable.getValuesAt(15)).toEqual([
      {key: "A", date: 15, price: 1125},
      {key: "B", date: 15, price: 1900},
    ])
  })

  test("extrapolate", () => {
    expect(dataTable.getValuesAt(30)).toEqual([
      {key: "A", date: 30, price: 1500},
      {key: "B", date: 30, price: 1400},
    ])

    expect(dataTable.getValuesAt(40)).toEqual([
      {key: "A", date: 40, price: 1750},
      {key: "B", date: 40, price: 1200},
    ])
  })
})
