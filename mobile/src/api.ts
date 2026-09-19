import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

const TOKEN_KEY = "collabdraw.jwt";

export type User = {
  id: string;
  name: string;
  email: string;
  token: string;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", token);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
  return body;
}

export async function login(email: string, password: string) {
  const result = await request<{ user: User }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, result.user.token);
  return result.user;
}

export async function signup(name: string, email: string, password: string) {
  await request("/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return login(email, password);
}

export async function restoreToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function createRoom(name: string, token: string) {
  return request<{ data: { roomId: number } }>("/room", {
    method: "POST",
    body: JSON.stringify({ name: name.trim().replaceAll(" ", "-").toLowerCase() }),
  }, token);
}

export async function findRoom(slug: string) {
  return request<{ room: { id: number; slug: string } | null }>(`/room/${encodeURIComponent(slug)}`);
}

export async function getShapes(roomId: number, token: string) {
  return request<import("./types").Shape[]>(`/shapes/${roomId}`, {}, token);
}
