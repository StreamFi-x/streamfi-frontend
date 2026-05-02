export type UnitCategory = 'length' | 'mass' | 'volume' | 'temperature';

export type LengthUnit = 'm' | 'km' | 'cm' | 'mm' | 'mi' | 'ft' | 'in' | 'yd';
export type MassUnit = 'kg' | 'g' | 'mg' | 'lb' | 'oz';
export type VolumeUnit = 'l' | 'ml' | 'gal' | 'qt' | 'pt' | 'fl_oz';
export type TemperatureUnit = 'c' | 'f' | 'k';

export type Unit = LengthUnit | MassUnit | VolumeUnit | TemperatureUnit;

export interface ConversionRequest {
  from: Unit;
  to: Unit;
  value: number;
}

export interface ConversionResponse {
  converted: number;
  from: Unit;
  to: Unit;
  value: number;
}

export interface ConversionError {
  error: string;
}
