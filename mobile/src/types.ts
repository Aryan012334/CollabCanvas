export type Point = { x: number; y: number };

export type Shape = {
  id: number;
  roomId?: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  type: string;
  points?: Point[];
  strokeWidth?: number;
  strokeColor?: string;
  strokeStyle?: "solid" | "dotted" | "dashed";
};

export type SocketEvent = {
  type: string;
  roomId?: number | string;
  shape?: Shape;
  tempId?: number;
  realId?: number;
  shapeId?: number;
  userId?: string;
  username?: string;
  name?: string;
  x?: number;
  y?: number;
  message?: string;
};
