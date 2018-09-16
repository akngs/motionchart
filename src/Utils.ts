export function find<T>(data: T[], func: (datum: T) => boolean): T | undefined {
  for (let i = 0; i < data.length; i++)
    if (func(data[i])) return data[i]
  return undefined
}

export function isInRange(value: number, range: [number, number]): boolean {
  return range[0] <= value && value <= range[1]
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
