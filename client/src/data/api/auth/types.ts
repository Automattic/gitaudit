export interface User {
  id: number;
  username: string;
  githubId: number;
  avatarUrl?: string;
}

export interface AuthVerifyResponse {
  user: User;
}
