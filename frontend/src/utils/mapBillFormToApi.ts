export type BillForm = Record<string, any>
export const mapBillFormToApi = (input: BillForm) => {
  const o: any = {}
  const set = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && isNaN(v))) o[k] = v }
  const num = (v: any) => { const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? undefined : n }
  const iso = (v: any) => { try { return v && typeof v.toISOString === 'function' ? v.toISOString() : (typeof v === 'string' ? v : undefined) } catch { return undefined } }
  const billType = (v: any) => { const s = String(v || '').toLowerCase(); return s === 'leasing' ? 'leasing' : s === 'advance' || s === 'advancement' ? 'advance' : 'cash' }
  const vehicleType = (v: any) => { const s = String(v || '').toUpperCase(); if (s.includes('TRICYCLE')) return 'E-TRICYCLE'; if (s.includes('BICYCLE')) return 'E-MOTORBICYCLE'; return 'E-MOTORCYCLE' }
  set('billType', billType(input.bill_type))
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
  set('vehicleType', vehicleType(input.vehicle_type))
  return o
}
