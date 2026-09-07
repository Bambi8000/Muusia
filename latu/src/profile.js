export const DEFAULT_PROFILE = {
  id: "servo-a", name: "A — Servo Z (multi-tip brush)", notes: "",
  workW: 330, workH: 240, originX: 0, originY: 0, flipY: false, pauseCmd: "M0",
  startG: "G21 ; mm\nG90 ; absolute\nG28 ; home", endG: "G0 X0 Y0",
  zMode: "servo", servoName: "pen", servoUp: 90, servoDown: 35,
  penUp: 3, penDown: 0, zFeed: 600, zHop: 1.5, zHopOn: true,
  penDelayDown: 120, penDelayUp: 80, feedDraw: 1800, feedTravel: 6000,
  rotOn: false, rotStepper: "pen_rotate", rotThresh: 20,
  dipOn: false, dipX: 320, dipY: 20, dipZ: -2, dipEvery: 800, dipDwell: 600,
  maintOn: false, maintEvery: 4000, maintMsg: "Advance chalk / re-sharpen",
  maintPark: false, maintX: 20, maintY: 20,
  laserOn: false, laserOffX: 0, laserOffY: 0,
  laserOnCmd: "SET_PIN PIN=laser VALUE=1", laserOffCmd: "SET_PIN PIN=laser VALUE=0",
  moonrakerUrl: "ws://192.168.0.57:7125/websocket", canvasCheckOn: false,
  doseTemplate: "INK_DOSE UL={UL}", airTemplate: "AIR_PULSE MS={MS}", snippets: [],
};

export const DEFAULT_PROFILES = [
  DEFAULT_PROFILE,
  { ...DEFAULT_PROFILE, id: "bed-b", name: "B — Bed Z + rotation", zMode: "bed", rotOn: true },
];

export function normalizeProfile(profile, index = 0) {
  return { ...DEFAULT_PROFILE, ...profile, id: profile?.id || `profile-${Date.now()}-${index}`, snippets: Array.isArray(profile?.snippets) ? profile.snippets.map((item) => ({ ...item })) : [] };
}

export function loadProfiles(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem("latu-machines") || "null");
    const profiles = Array.isArray(parsed) ? parsed : parsed?.machines;
    return profiles?.length ? profiles.map(normalizeProfile) : DEFAULT_PROFILES.map(normalizeProfile);
  } catch { return DEFAULT_PROFILES.map(normalizeProfile); }
}

export function saveProfiles(profiles, storage = globalThis.localStorage) {
  try { storage.setItem("latu-machines", JSON.stringify({ app: "latu-machines", v: 1, machines: profiles })); } catch { /* Storage may be unavailable in private/file contexts. */ }
}

export function profileForDocument(profiles, source, fallbackId) {
  const match = source.match(/^;\s*LATU profile:\s*(.+?)\s*$/mi);
  return profiles.find((profile) => profile.name === match?.[1]) || profiles.find((profile) => profile.id === fallbackId) || profiles[0];
}
