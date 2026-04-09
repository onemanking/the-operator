import Phaser from "phaser";

const FRAGMENT_SHADER = `
precision mediump float;

uniform float time;
uniform vec2 resolution;
uniform float active;
uniform float scanning;
uniform vec2 scanPoint;
uniform float scanRadius;
uniform float scanDirection;
uniform float noiseIntensity;

varying vec2 fragCoord;

float hash(vec2 point)
{
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 point)
{
  vec2 base = floor(point);
  vec2 fraction = fract(point);
  float a = hash(base);
  float b = hash(base + vec2(1.0, 0.0));
  float c = hash(base + vec2(0.0, 1.0));
  float d = hash(base + vec2(1.0, 1.0));
  vec2 smoothFraction = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(mix(a, b, smoothFraction.x), mix(c, d, smoothFraction.x), smoothFraction.y);
}

void main(void)
{
    vec2 uv = fragCoord.xy / resolution.xy;
    vec2 centered = uv - 0.5;
    centered.x *= resolution.x / resolution.y;
    vec2 scanDelta = uv - scanPoint;
    scanDelta.x *= resolution.x / resolution.y;

    float vignette = 1.0 - smoothstep(0.18, 0.95, length(centered));
    float grain = hash(floor(fragCoord.xy * 0.65) + floor(time * 18.0)) - 0.5;
    float horizontalScan = step(0.55, fract(fragCoord.y * 0.35 + time * 0.8)) * 0.05;
    float bandCore = 1.0 - smoothstep(scanRadius * 0.5, scanRadius * 1.45, abs(scanDelta.x));
    float bandHalo = 1.0 - smoothstep(scanRadius * 1.2, scanRadius * 3.4, abs(scanDelta.x));
    float lensFocus = 1.0 - smoothstep(0.02, 0.18, abs(scanDelta.y));
    float headOffset = scanDirection * scanRadius * 0.72;
    float headLine = 1.0 - smoothstep(scanRadius * 0.1, scanRadius * 0.36, abs(scanDelta.x - headOffset));
    float scanLight = scanning * (bandHalo * 0.38 + bandCore * (0.34 + lensFocus * 0.28));
    float readerHead = scanning * headLine * (0.62 + lensFocus * 0.38);
    float lensContrast = scanning * bandCore * 0.22;
    float staticNoise = noiseIntensity * bandHalo * (noise(fragCoord.xy * 0.12 + time * 12.0) - 0.5);

    vec3 baseColor = vec3(0.07, 0.012, 0.01);
    vec3 emberColor = vec3(0.18, 0.045, 0.025);
    vec3 filmColor = mix(baseColor, emberColor, (1.0 - uv.y) * 0.55 + vignette * 0.35);
    filmColor += grain * 0.035;
    filmColor -= horizontalScan;
    filmColor += lensContrast * vec3(0.07, 0.02, 0.015);

    vec3 color = mix(vec3(0.0), filmColor, active);
    color += active * vec3(0.015, 0.004, 0.002);
    color += active * scanLight * vec3(0.22, 0.055, 0.03);
    color += active * readerHead * vec3(0.34, 0.18, 0.11);
    color += staticNoise * vec3(0.6, 0.24, 0.16);

    float alpha = active * (0.8 + scanLight * 0.08 + readerHead * 0.09);

    gl_FragColor = vec4(color, alpha);
}
`;

export function createSafetyFilterShader() {
  return new Phaser.Display.BaseShader(
    "SafetyFilterFilm",
    FRAGMENT_SHADER,
    undefined,
    {
      active: { type: "1f", value: 0 },
      scanning: { type: "1f", value: 0 },
      scanPoint: { type: "2f", value: { x: 0.5, y: 0.5 } },
      scanRadius: { type: "1f", value: 0.11 },
      scanDirection: { type: "1f", value: 1 },
      noiseIntensity: { type: "1f", value: 0 },
    },
  );
}
