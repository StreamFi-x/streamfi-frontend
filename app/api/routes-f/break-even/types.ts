export interface BreakEvenRequest {
  fixed_costs: number;
  price_per_unit: number;
  variable_cost_per_unit: number;
}

export interface BreakEvenResponse {
  break_even_units: number;
  break_even_revenue: number;
  contribution_margin: number;
}
