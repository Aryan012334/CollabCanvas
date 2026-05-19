import { api } from "@/lib/axios";
import { parseCookies, setCookie, destroyCookie } from "nookies";

interface LoginPayload {
  email: string;
  password: string;
}

interface RoomPayload {
  name: string;
}

function generalizeRoomName(name: string) {
  return name.replaceAll(" ", "-").toLowerCase();
}

export function degeneralizeRoomName(name: string) {
  return name
    .replaceAll("-", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Returns axios config with a fresh token read from the cookie on every call. */
function authOptions() {
  const { token } = parseCookies();
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    withCredentials: true,
  };
}

export const login = async (payload: LoginPayload) => {
  try {
    const res = await api.post("/login", payload, { withCredentials: true });
    return res?.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Login failed";
    throw new Error(message);
  }
};

export const signup = async (payload: LoginPayload) => {
  try {
    const res = await api.post("/signup", payload, { withCredentials: true });
    return res?.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Signup failed";
    throw new Error(message);
  }
};

export const createRoom = async (payload: RoomPayload) => {
  const slug = generalizeRoomName(payload.name);
  payload.name = slug;
  try {
    const res = await api.post("/room", payload, authOptions());
    return res?.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Room creation failed";
    throw new Error(message);
  }
};

export const deleteRoom = async (roomId: string) => {
  try {
    const res = await api.delete(`/room/${roomId}`, authOptions());
    return res?.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Something went wrong";
    throw new Error(message);
  }
};

export const getRooms = async () => {
  try {
    const res = await api.get("/rooms", authOptions());
    return res?.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Something went wrong";
    throw new Error(message);
  }
};

export const getAllShapesInRoom = async (roomId: number) => {
  try {
    const res = await api.get(`/shapes/${roomId}`, authOptions());
    return res?.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Something went wrong";
    throw new Error(message);
  }
};

export const getUser = async () => {
  try {
    const res = await api.get("/me", authOptions());
    return res.data?.user;
  } catch (err: any) {
    const message = err?.response?.data?.message || "Something went wrong";
    throw new Error(message);
  }
};
