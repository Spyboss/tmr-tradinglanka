import { VEHICLE_TYPES, BILL_TYPES } from '../constants/billEnums.js'

export const snakeToCamel = (input: any) => {
  const o: any = {}
  const set = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && isNaN(v))) o[k] = v }
  const num = (v: any) => { const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? undefined : n }
  const iso = (v: any) => { try { return v && typeof v.toISOString === 'function' ? v.toISOString() : (typeof v === 'string' ? v : undefined) } catch { return undefined } }
  set('billType', input.bill_type)
  set('billDate', iso(input.bill_date))
  set('bikePrice', num(input.bike_price))
  set('totalAmount', num(input.total_amount))
  set('downPayment', num(input.down_payment))
  set('balanceAmount', num(input.balance_amount))
  set('motorNumber', input.motor_number)
  set('chassisNumber', input.chassis_number)
  set('customerName', input.customer_name)
  set('customerNIC', input.customer_nic)
  set('customerAddress', input.customer_address)
  set('bikeModel', input.model_name)
  set('estimatedDeliveryDate', iso(input.estimated_delivery_date))
  set('vehicleType', input.vehicle_type)
  return o
}

export const normalizeEnums = (input: any) => {
  const o = { ...input }
  const bt = String(o.billType || '').toLowerCase()
  o.billType = BILL_TYPES.includes(bt as any) ? bt : 'cash'
  const vt = String(o.vehicleType || '').toUpperCase()
  o.vehicleType = vt.includes('TRICYCLE') ? 'E-TRICYCLE' : vt.includes('BICYCLE') ? 'E-MOTORBICYCLE' : 'E-MOTORCYCLE'
  return o
}

export const coerceTypes = (input: any) => {
  const o = { ...input }
  const num = (v: any) => { const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? undefined : n }
  if (o.bikePrice !== undefined) o.bikePrice = num(o.bikePrice)
  if (o.totalAmount !== undefined) o.totalAmount = num(o.totalAmount)
  if (o.downPayment !== undefined) o.downPayment = num(o.downPayment)
  if (o.balanceAmount !== undefined) o.balanceAmount = num(o.balanceAmount)
  return o
}

export const cleanEmpty = (input: any) => {
  const o: any = {}
  Object.keys(input || {}).forEach(k => {
    const v = (input as any)[k]
    if (v !== undefined && v !== null && v !== '') o[k] = v
  })
  return o
}

export const normalizeBillPayload = (raw: any) => {
  const s = snakeToCamel(raw)
  const e = normalizeEnums(s)
  const c = coerceTypes(e)
  const n = cleanEmpty(c)
  return n
}
