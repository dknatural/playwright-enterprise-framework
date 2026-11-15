export interface CreateUserRequest {
  email: string;
  displayName: string;
  password: string;
}
export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
}
export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  status: string;
}
