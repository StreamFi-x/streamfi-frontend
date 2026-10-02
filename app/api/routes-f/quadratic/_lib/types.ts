export interface Root {
  real: number;
  imaginary?: number;
}

export interface Vertex {
  x: number;
  y: number;
}

export interface QuadraticResponse {
  roots: Root[];
  discriminant: number;
  vertex: Vertex;
  axis_of_symmetry: number;
  has_complex_roots: boolean;
}
