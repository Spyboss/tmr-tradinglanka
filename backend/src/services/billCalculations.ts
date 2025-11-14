import Bill from '../models/Bill.js'

export const applyVehicleTypeFlags = async (payload: any) => {
  const o = { ...payload }
  const vt = String(o.vehicleType || '').toUpperCase()
  o.isTricycle = vt === 'E-TRICYCLE'
  o.isEbicycle = vt === 'E-MOTORBICYCLE'
  if (o.isTricycle) {
    const count = await Bill.countDocuments({ isTricycle: true })
    if (count === 0) o.isFirstTricycleSale = true
  }
  return o
}

export const computeRMV = (payload: any) => {
  const o = { ...payload }
  if (o.isTricycle || o.isEbicycle) { o.rmvCharge = 0; return o }
  if (o.billType === 'cash') { o.rmvCharge = 13000; return o }
  if (o.billType === 'leasing') { o.rmvCharge = 13500; return o }
  return o
}

export const computeTotals = (payload: any) => {
  const o = { ...payload }
  const bp = parseFloat(o.bikePrice || 0)
  const rmv = parseFloat(o.rmvCharge || 0)
  if (o.billType === 'leasing') {
    const dp = parseFloat(o.downPayment || 0)
    o.totalAmount = dp
    o.downPayment = dp
  } else if (o.billType === 'advance') {
    const dp = parseFloat(o.downPayment || 0)
    o.totalAmount = bp
    o.downPayment = dp
    o.balanceAmount = o.totalAmount - dp
  } else {
    if (o.isEbicycle || o.isTricycle) {
      o.totalAmount = bp
    } else {
      o.totalAmount = bp + rmv
    }
  }
  o.status = o.billType === 'advance' ? 'pending' : 'completed'
  return o
}
