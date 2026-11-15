import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { CreateUserRequest, UserResponse } from '../models/user.model';

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string,
    private readonly token?: string,
  ) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }
  private url(path: string): string {
    return `${this.baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
  async get(path: string): Promise<APIResponse> {
    return this.request.get(this.url(path), { headers: this.headers() });
  }
  async post(path: string, data: unknown): Promise<APIResponse> {
    return this.request.post(this.url(path), { headers: this.headers(), data });
  }
  async put(path: string, data: unknown): Promise<APIResponse> {
    return this.request.put(this.url(path), { headers: this.headers(), data });
  }
  async delete(path: string): Promise<APIResponse> {
    return this.request.delete(this.url(path), { headers: this.headers() });
  }
  async createUser(payload: CreateUserRequest): Promise<UserResponse> {
    const response = await this.post('/users', payload);
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()) as UserResponse;
  }
  async getUser(id: string): Promise<UserResponse> {
    const response = await this.get(`/users/${encodeURIComponent(id)}`);
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as UserResponse;
  }
}
