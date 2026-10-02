export interface Stinger {
  id: string;
  name: string;
  url: string;
}

export interface StingerLibraryResponse {
  active: string | null;
  library: Stinger[];
}

export interface SelectStingerRequest {
  creator_id: string;
  stinger_id: string;
}

export interface AddStingerRequest {
  creator_id: string;
  name: string;
  url: string;
}
