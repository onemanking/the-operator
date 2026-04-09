import Phaser from "phaser";

const FRAGMENT_SHADER = `
precision mediump float;

uniform float time;
uniform vec2 resolution;
uniform float active;
uniform float intensity;
uniform float overheat;
uniform float bandSpeed;
uniform float bandThickness;
uniform float flickerRate;

varying vec2 fragCoord;

float hash(float value)
{
    return fract(sin(value) * 43758.5453123);
}

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

float wrappedDistance(float value, float center)
{
    return abs(fract(value - center + 0.5) - 0.5);
}

void main(void)
{
    vec2 uv = fragCoord.xy / resolution.xy;
    float bandCenter = fract(time * bandSpeed);
    float bandDistance = wrappedDistance(uv.y, bandCenter);
    float hotBand = 1.0 - smoothstep(bandThickness, bandThickness + 0.16, bandDistance);
    float staticLines = step(
        0.68 - intensity * 0.16 - overheat * 0.08,
        fract(uv.y * (58.0 + intensity * 46.0) - time * (1.6 + overheat * 1.25))
    );
    float grain = noise(fragCoord.xy * 0.19 + vec2(time * 14.0, time * 6.0)) - 0.5;
    float stripNoise = hash(vec2(floor(fragCoord.y * 0.7), floor(time * 24.0))) - 0.5;
    float flickerSeed = noise(vec2(time * flickerRate, floor(uv.y * 32.0)));
    float flicker = smoothstep(0.76, 0.99, flickerSeed + intensity * 0.22 + overheat * 0.16);
    float blackout = flicker * overheat * 0.16;

    vec3 warmGlow = mix(vec3(0.18, 0.05, 0.01), vec3(0.56, 0.14, 0.03), overheat);
    vec3 buzzColor = warmGlow * (0.09 + hotBand * 0.24 + staticLines * 0.1);
    buzzColor += vec3(0.28, 0.08, 0.02) * max(grain, 0.0) * intensity * 0.32;
    buzzColor += vec3(0.42, 0.1, 0.04) * max(stripNoise, 0.0) * (0.1 + overheat * 0.2);
    buzzColor += warmGlow * flicker * 0.22;

    float alpha = active * clamp(
        intensity * 0.12 +
        hotBand * (0.14 + intensity * 0.08) +
        staticLines * (0.08 + overheat * 0.06) +
        abs(grain) * intensity * 0.18 +
        max(stripNoise, 0.0) * 0.18 +
        flicker * 0.08,
        0.0,
        0.82
    );

    gl_FragColor = vec4(buzzColor, alpha * (1.0 - blackout));
}
`;

export function createThermalFeedbackShader() {
  return new Phaser.Display.BaseShader(
    "ThermalFeedbackFilm",
    FRAGMENT_SHADER,
    undefined,
    {
      active: { type: "1f", value: 0 },
      intensity: { type: "1f", value: 0 },
      overheat: { type: "1f", value: 0 },
      bandSpeed: { type: "1f", value: 0.21 },
      bandThickness: { type: "1f", value: 0.16 },
      flickerRate: { type: "1f", value: 6.4 },
    },
  );
}
