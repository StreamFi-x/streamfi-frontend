export type LoginMethod = "google" | "github" | "twitter" | "password";

export interface UserLoginMethods {
  user_id: string;
  methods: LoginMethod[];
}

export interface OauthTwitterUnlinkBody {
  user_id: string;
}

export interface OauthTwitterUnlinkResponse {
  user_id: string;
  methods: LoginMethod[];
}
