export type LoginMethod = "google" | "github" | "twitter" | "password";

export interface UserLoginMethods {
  user_id: string;
  methods: LoginMethod[];
}

export interface OauthGoogleUnlinkBody {
  user_id: string;
}

export interface OauthGoogleUnlinkResponse {
  user_id: string;
  methods: LoginMethod[];
}
