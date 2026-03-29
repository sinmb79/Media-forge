export const WAN22_CAMERA_MAP: Record<string, string> = {
  dynamic_pan: "camera pans briskly across the scene with energetic movement",
  orbital: "camera orbits clockwise around subject",
  simple_push_in: "camera slowly pushes forward, shallow depth of field",
  slow_push_in: "camera slowly pushes forward, shallow depth of field",
};

export function mapCameraLanguageToWan22(cameraLanguage: string): string {
  return WAN22_CAMERA_MAP[cameraLanguage] ?? cameraLanguage;
}
