import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, PanResponder, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { createRoom, findRoom, getShapes, login, logout, restoreToken, signup, User } from "./api";
import { openRoomSocket } from "./socket";
import { Point, Shape, SocketEvent } from "./types";

type Screen = "auth" | "rooms" | "canvas";

export default function MobileApp() {
  const [session, setSession] = useState<User | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [screen, setScreen] = useState<Screen>("auth");

  useEffect(() => {
    restoreToken().then((token) => {
      if (token) {
        setSession({ id: "", name: "", email: "", token });
        setScreen("rooms");
      }
    });
  }, []);

  if (!session || screen === "auth") return <AuthScreen onAuthenticated={(user) => { setSession(user); setScreen("rooms"); }} />;
  if (screen === "rooms") return <RoomScreen token={session.token} onJoined={(id) => { setRoomId(id); setScreen("canvas"); }} onLogout={() => { logout(); setSession(null); setScreen("auth"); }} />;
  return <CanvasScreen token={session.token} roomId={roomId!} onExit={() => setScreen("rooms")} />;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const user = isSignup ? await signup(name, email, password) : await login(email, password);
      onAuthenticated(user);
    } catch (error) {
      Alert.alert("Authentication failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="light" />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.centered}>
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>COLLABDRAW MOBILE</Text>
        <Text style={styles.title}>{isSignup ? "Create your account" : "Draw together"}</Text>
        <Text style={styles.subtitle}>Real-time whiteboarding, wherever the room is.</Text>
        {isSignup && <TextInput autoCapitalize="words" placeholder="Name" placeholderTextColor="#82909d" style={styles.input} value={name} onChangeText={setName} />}
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#82909d" style={styles.input} value={email} onChangeText={setEmail} />
        <TextInput secureTextEntry placeholder="Password" placeholderTextColor="#82909d" style={styles.input} value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={busy}><Text style={styles.primaryButtonText}>{busy ? "Working..." : isSignup ? "Sign up" : "Log in"}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setIsSignup((value) => !value)}><Text style={styles.link}>{isSignup ? "Already have an account? Log in" : "New to CollabDraw? Sign up"}</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function RoomScreen({ token, onJoined, onLogout }: { token: string; onJoined: (roomId: number) => void; onLogout: () => void }) {
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [busy, setBusy] = useState(false);

  async function joinRoom() {
    setBusy(true);
    try {
      const numericId = Number(roomCode.trim());
      if (Number.isInteger(numericId) && numericId > 0) return onJoined(numericId);
      const result = await findRoom(roomCode.trim());
      if (!result.room) throw new Error("Room not found");
      onJoined(result.room.id);
    } catch (error) {
      Alert.alert("Could not join room", error instanceof Error ? error.message : "Please check the room code.");
    } finally { setBusy(false); }
  }

  async function makeRoom() {
    setBusy(true);
    try { onJoined((await createRoom(roomName, token)).data.roomId); }
    catch (error) { Alert.alert("Could not create room", error instanceof Error ? error.message : "Please try another name."); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="light" />
    <View style={styles.roomPage}>
      <View style={styles.roomHeader}><View><Text style={styles.eyebrow}>YOUR ROOMS</Text><Text style={styles.pageTitle}>Choose a room</Text></View><TouchableOpacity onPress={onLogout}><Text style={styles.link}>Log out</Text></TouchableOpacity></View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Join an existing room</Text><Text style={styles.panelHint}>Use a numeric room ID or its slug.</Text><TextInput placeholder="Room ID or slug" placeholderTextColor="#82909d" style={styles.input} value={roomCode} onChangeText={setRoomCode} autoCapitalize="none" /><TouchableOpacity style={styles.primaryButton} onPress={joinRoom} disabled={busy || !roomCode.trim()}><Text style={styles.primaryButtonText}>Join room</Text></TouchableOpacity></View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Create a room</Text><Text style={styles.panelHint}>The existing API limits names to 3-20 characters.</Text><TextInput placeholder="e.g. design-sprint" placeholderTextColor="#82909d" style={styles.input} value={roomName} onChangeText={setRoomName} autoCapitalize="none" /><TouchableOpacity style={styles.secondaryButton} onPress={makeRoom} disabled={busy || roomName.trim().length < 3}><Text style={styles.secondaryButtonText}>Create room</Text></TouchableOpacity></View>
    </View>
  </SafeAreaView>;
}

function CanvasScreen({ token, roomId, onExit }: { token: string; roomId: number; onExit: () => void }) {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [cursors, setCursors] = useState<Record<string, Point>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const pointsRef = useRef<Point[]>([]);

  function sendSocket(event: Record<string, unknown>) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  }

  useEffect(() => {
    let active = true;
    getShapes(roomId, token).then((loaded) => { if (active) setShapes(loaded); }).catch((error) => Alert.alert("Could not load canvas", error.message));
    const socket = openRoomSocket(token, (event) => handleSocketEvent(event));
    socketRef.current = socket;
    socket.onopen = () => sendSocket({ type: "join-room", roomId });
    socket.onerror = () => Alert.alert("Connection problem", "The drawing server could not be reached.");
    return () => { active = false; if (socket.readyState === WebSocket.OPEN) { sendSocket({ type: "leave-room", roomId }); socket.close(); } };
  }, [roomId, token]);

  function handleSocketEvent(event: SocketEvent) {
    if (event.type === "shape:create" && event.shape) setShapes((current) => current.some((shape) => shape.id === event.shape!.id) ? current : [...current, event.shape!]);
    else if (event.type === "shape:id_assigned" && event.tempId !== undefined && event.realId !== undefined) setShapes((current) => current.map((shape) => shape.id === event.tempId ? { ...shape, id: event.realId! } : shape));
    else if (event.type === "shape:delete" && event.shapeId !== undefined) setShapes((current) => current.filter((shape) => shape.id !== Number(event.shapeId)));
    else if (event.type === "canvas:clear") setShapes([]);
    else if (event.type === "cursor:move" && event.userId && event.x !== undefined && event.y !== undefined) setCursors((current) => ({ ...current, [event.userId!]: { x: event.x!, y: event.y! } }));
    else if (event.type === "user_left" && event.userId) setCursors((current) => { const next = { ...current }; delete next[event.userId!]; return next; });
    else if (event.type === "error") Alert.alert("Room error", event.message ?? "The server rejected an event.");
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => { pointsRef.current = [{ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }]; setDraft(pointsRef.current); },
    onPanResponderMove: (event) => { const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }; pointsRef.current = [...pointsRef.current, point]; setDraft(pointsRef.current); sendSocket({ type: "cursor:move", roomId, x: point.x, y: point.y }); },
    onPanResponderRelease: () => {
      const points = pointsRef.current;
      if (points.length > 1) {
        const startX = Math.min(...points.map((point) => point.x));
        const startY = Math.min(...points.map((point) => point.y));
        const endX = Math.max(...points.map((point) => point.x));
        const endY = Math.max(...points.map((point) => point.y));
        sendSocket({ type: "shape:create", roomId, shape: { startX, startY, width: endX - startX, height: endY - startY, type: "FREEHAND", points, strokeWidth: 4, strokeColor: "#f2f0e9", strokeStyle: "solid" } });
      }
      pointsRef.current = []; setDraft([]);
    },
  }), [roomId]);

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="light" />
    <View style={styles.canvasHeader}><TouchableOpacity onPress={onExit}><Text style={styles.link}>‹ Rooms</Text></TouchableOpacity><Text style={styles.canvasTitle}>Room {roomId}</Text><View style={styles.livePill}><Text style={styles.liveText}>LIVE</Text></View></View>
    <View style={styles.canvas} {...panResponder.panHandlers}>
      <Svg style={StyleSheet.absoluteFill}>{shapes.map((shape) => <Stroke key={`${shape.id}`} shape={shape} />)}{draft.length > 1 && <Path d={pointsToPath(draft)} stroke="#f2f0e9" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />}</Svg>
      {Object.entries(cursors).map(([id, cursor]) => <View key={id} style={[styles.cursor, { left: cursor.x - 5, top: cursor.y - 5 }]}><View style={styles.cursorDot} /></View>)}
      <View style={styles.canvasHint}><Text style={styles.canvasHintText}>Draw with your finger</Text></View>
    </View>
  </SafeAreaView>;
}

function Stroke({ shape }: { shape: Shape }) {
  if (shape.type === "FREEHAND" && shape.points && shape.points.length > 1) return <Path d={pointsToPath(shape.points)} stroke={shape.strokeColor ?? "#f2f0e9"} strokeWidth={shape.strokeWidth ?? 4} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  if (shape.type === "LINE") return <Path d={`M ${shape.startX} ${shape.startY} L ${shape.startX + shape.width} ${shape.startY + shape.height}`} stroke={shape.strokeColor ?? "#f2f0e9"} strokeWidth={shape.strokeWidth ?? 3} strokeLinecap="round" fill="none" />;
  return null;
}

function pointsToPath(points: Point[]) { return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#15232d" }, centered: { flex: 1, justifyContent: "center", padding: 24 }, authCard: { backgroundColor: "#203540", borderRadius: 24, padding: 24, gap: 14 }, eyebrow: { color: "#93b7ad", fontSize: 12, fontWeight: "700", letterSpacing: 1.8 }, title: { color: "#f2f0e9", fontSize: 32, fontWeight: "800" }, subtitle: { color: "#adc0c4", fontSize: 15, lineHeight: 22, marginBottom: 8 }, input: { backgroundColor: "#14252e", borderColor: "#3b5661", borderWidth: 1, borderRadius: 12, color: "#f2f0e9", paddingHorizontal: 15, paddingVertical: 13, fontSize: 16 }, primaryButton: { backgroundColor: "#d27452", borderRadius: 12, paddingVertical: 15, alignItems: "center" }, primaryButtonText: { color: "#fffaf4", fontWeight: "800", fontSize: 16 }, secondaryButton: { borderColor: "#93b7ad", borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" }, secondaryButtonText: { color: "#bcd5ce", fontWeight: "800", fontSize: 16 }, link: { color: "#e5a17f", textAlign: "center", fontWeight: "700", paddingVertical: 4 }, roomPage: { flex: 1, padding: 24, gap: 18 }, roomHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, pageTitle: { color: "#f2f0e9", fontSize: 30, fontWeight: "800", marginTop: 5 }, panel: { backgroundColor: "#203540", borderRadius: 18, padding: 18, gap: 12 }, panelTitle: { color: "#f2f0e9", fontSize: 18, fontWeight: "800" }, panelHint: { color: "#adc0c4", lineHeight: 20 }, canvasHeader: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, canvasTitle: { color: "#f2f0e9", fontSize: 17, fontWeight: "800" }, livePill: { backgroundColor: "#315b50", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, liveText: { color: "#c6f3df", fontSize: 11, fontWeight: "800" }, canvas: { flex: 1, backgroundColor: "#263f4a", overflow: "hidden" }, cursor: { position: "absolute", width: 12, height: 12 }, cursorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e5a17f", borderColor: "#fffaf4", borderWidth: 2 }, canvasHint: { position: "absolute", bottom: 20, alignSelf: "center", backgroundColor: "#15232dcc", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }, canvasHintText: { color: "#c5d0d0", fontSize: 12 },
});
