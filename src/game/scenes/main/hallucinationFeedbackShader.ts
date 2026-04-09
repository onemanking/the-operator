import Phaser from "phaser";

const FRAGMENT_SHADER = `
precision mediump float;

uniform float time;
uniform vec2 resolution;
uniform float active;
uniform float intensity;
uniform float ghostOffsetPx;
uniform float shimmerRate;

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
    float offsetNorm = ghostOffsetPx / resolution.x;
    float wander = sin(uv.y * 26.0 + time * shimmerRate) * offsetNorm * (0.4 + intensity * 0.6);
    float scanJitter = (noise(vec2(floor(uv.y * 84.0), floor(time * 12.0))) - 0.5) * offsetNorm * intensity * 1.8;
    float ghostLine = smoothstep(0.62, 0.98, noise(vec2(floor(uv.y * 44.0), time * 1.5 + uv.x * 0.5)) + intensity * 0.22);
    float shimmer = smoothstep(0.55, 1.0, sin(time * shimmerRate * 1.9 + uv.y * 18.0) * 0.5 + 0.5);
    float grain = noise(fragCoord.xy * 0.13 + vec2(time * 4.0, time * 2.0)) - 0.5;

    vec3 ghostViolet = vec3(0.56, 0.43, 1.0);
    vec3 ghostLavender = vec3(0.83, 0.78, 1.0);
    vec3 color = mix(ghostViolet, ghostLavender, 0.34 + shimmer * 0.28);
    color *= 0.42 + intensity * 0.58;
    color += vec3(0.09, 0.07, 0.16) * max(grain, 0.0) * intensity;

    float alpha = active * clamp(
        ghostLine * (0.08 + intensity * 0.16) +
        shimmer * intensity * 0.06 +
        abs(wander + scanJitter) * resolution.x * 0.08 +
        abs(grain) * intensity * 0.06,
        0.0,
        0.34
    );

    gl_FragColor = vec4(color, alpha);
}
`;

export function createHallucinationFeedbackShader() {
  return new Phaser.Display.BaseShader(
    "HallucinationFeedbackFilm",
    FRAGMENT_SHADER,
    undefined,
    {
      active: { type: "1f", value: 0 },
      intensity: { type: "1f", value: 0 },
      ghostOffsetPx: { type: "1f", value: 2.2 },
      shimmerRate: { type: "1f", value: 2.8 },
    },
  );
}
