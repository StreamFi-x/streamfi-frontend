import { Unit, UnitCategory, LengthUnit, MassUnit, VolumeUnit, TemperatureUnit } from './types';

export const LENGTH_UNITS: Record<LengthUnit, number> = {
  m: 1,        // Base unit
  km: 0.001,   // 1 km = 1000 m
  cm: 100,     // 1 m = 100 cm
  mm: 1000,    // 1 m = 1000 mm
  mi: 0.000621371, // 1 m = 0.000621371 miles
  ft: 3.28084, // 1 m = 3.28084 feet
  in: 39.3701, // 1 m = 39.3701 inches
  yd: 1.09361, // 1 m = 1.09361 yards
};

export const MASS_UNITS: Record<MassUnit, number> = {
  kg: 1,       // Base unit
  g: 1000,     // 1 kg = 1000 g
  mg: 1000000, // 1 kg = 1000000 mg
  lb: 2.20462, // 1 kg = 2.20462 pounds
  oz: 35.274,  // 1 kg = 35.274 ounces
};

export const VOLUME_UNITS: Record<VolumeUnit, number> = {
  l: 1,        // Base unit
  ml: 1000,    // 1 l = 1000 ml
  gal: 0.264172, // 1 l = 0.264172 gallons
  qt: 1.05669, // 1 l = 1.05669 quarts
  pt: 2.11338, // 1 l = 2.11338 pints
  fl_oz: 33.814, // 1 l = 33.814 fluid ounces
};

export function getUnitCategory(unit: Unit): UnitCategory {
  const lengthUnits: Set<Unit> = new Set(['m', 'km', 'cm', 'mm', 'mi', 'ft', 'in', 'yd']);
  const massUnits: Set<Unit> = new Set(['kg', 'g', 'mg', 'lb', 'oz']);
  const volumeUnits: Set<Unit> = new Set(['l', 'ml', 'gal', 'qt', 'pt', 'fl_oz']);
  const temperatureUnits: Set<Unit> = new Set(['c', 'f', 'k']);

  if (lengthUnits.has(unit)) return 'length';
  if (massUnits.has(unit)) return 'mass';
  if (volumeUnits.has(unit)) return 'volume';
  if (temperatureUnits.has(unit)) return 'temperature';
  
  throw new Error(`Unknown unit: ${unit}`);
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  const meters = value / LENGTH_UNITS[from];
  const result = meters * LENGTH_UNITS[to];
  return roundToSixDecimals(result);
}

export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  const kg = value / MASS_UNITS[from];
  const result = kg * MASS_UNITS[to];
  return roundToSixDecimals(result);
}

export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  const liters = value / VOLUME_UNITS[from];
  const result = liters * VOLUME_UNITS[to];
  return roundToSixDecimals(result);
}

export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  let celsius: number;
  
  // Convert to Celsius first
  switch (from) {
    case 'c':
      celsius = value;
      break;
    case 'f':
      celsius = (value - 32) * 5 / 9;
      break;
    case 'k':
      celsius = value - 273.15;
      break;
    default:
      throw new Error(`Unknown temperature unit: ${from}`);
  }
  
  // Convert from Celsius to target
  switch (to) {
    case 'c':
      return roundToSixDecimals(celsius);
    case 'f':
      return roundToSixDecimals(celsius * 9 / 5 + 32);
    case 'k':
      return roundToSixDecimals(celsius + 273.15);
    default:
      throw new Error(`Unknown temperature unit: ${to}`);
  }
}

export function roundToSixDecimals(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

export function convertUnits(value: number, from: Unit, to: Unit): number {
  const fromCategory = getUnitCategory(from);
  const toCategory = getUnitCategory(to);
  
  if (fromCategory !== toCategory) {
    throw new Error(`Cannot convert between different categories: ${fromCategory} to ${toCategory}`);
  }
  
  switch (fromCategory) {
    case 'length':
      return convertLength(value, from as LengthUnit, to as LengthUnit);
    case 'mass':
      return convertMass(value, from as MassUnit, to as MassUnit);
    case 'volume':
      return convertVolume(value, from as VolumeUnit, to as VolumeUnit);
    case 'temperature':
      return convertTemperature(value, from as TemperatureUnit, to as TemperatureUnit);
    default:
      throw new Error(`Unknown category: ${fromCategory}`);
  }
}
