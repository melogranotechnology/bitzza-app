// Stesse tariffe del prototipo SpesaGo e dell'app iOS. Importi in unità minime (centesimi).
const RATE_PER_KM_MINOR = { walking: 200, bicycle: 150, motorcycle: 180, car: 220 };
const WEIGHT_SURCHARGE_PER_KG_MINOR = 20;
const COMMISSION_RATE = 0.0017;
const CASHBACK_PERCENT = 2;
const CASHBACK_CAP_MINOR = 500;
const LIMITS = { itemsMinorMax: 50000, weightKgMax: 50, distanceKmMax: 50 };

const VEHICLES = Object.keys(RATE_PER_KM_MINOR);

function isSuitable(vehicle, distanceKm) {
  if (vehicle === 'walking') return distanceKm <= 1.5;
  if (vehicle === 'bicycle') return distanceKm <= 5;
  return true;
}

function quote({ itemsMinor, weightKg, distanceKm, vehicle }) {
  const courierFeeMinor = Math.round(distanceKm * RATE_PER_KM_MINOR[vehicle] + weightKg * WEIGHT_SURCHARGE_PER_KG_MINOR);
  const base = itemsMinor + courierFeeMinor;
  const commissionMinor = Math.round((base * COMMISSION_RATE) / (1 - COMMISSION_RATE));
  const cashbackMinor = Math.min(Math.round((itemsMinor * CASHBACK_PERCENT) / 100), CASHBACK_CAP_MINOR);
  return { courierFeeMinor, commissionMinor, totalMinor: base + commissionMinor, cashbackMinor };
}

module.exports = { VEHICLES, LIMITS, isSuitable, quote };
