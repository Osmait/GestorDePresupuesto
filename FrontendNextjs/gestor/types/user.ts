export interface User {
  created_at: string;
  id: string;
  name: string;
  last_name: string;
  email: string;
  password?: string;
  token?: string;
  confirmed: boolean;
  role: string;
}

export interface UserResponse {
  id: string;
  name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
}
