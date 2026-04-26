export type ContrastRequest = {
  foreground: string;
  background: string;
};
export type ContrastLevels = {
  aa_normal: boolean;
  aa_large: boolean;
  aaa_normal: boolean;
  aaa_large: boolean;
};
export type ContrastResponse = {
  ratio: number;
  levels: ContrastLevels;
};
