export interface RobotsRule {
  user_agent: string;
  allow?: string[];
  disallow?: string[];
}

export interface RobotsResponse {
  robots_txt: string;
}
