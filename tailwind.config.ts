import type { Config } from "tailwindcss";

// Material Design 3 配色角色 → Tailwind 颜色名（bg-primary、text-on-surface …）
const ROLES = [
  "primary", "on-primary", "primary-container", "on-primary-container",
  "secondary", "on-secondary", "secondary-container", "on-secondary-container",
  "tertiary", "on-tertiary", "tertiary-container", "on-tertiary-container",
  "error", "on-error", "error-container", "on-error-container",
  "success", "on-success", "success-container", "on-success-container",
  "surface", "on-surface", "on-surface-variant",
  "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest",
  "outline", "outline-variant", "inverse-surface", "inverse-on-surface", "scrim",
];

const colors = Object.fromEntries(
  ROLES.map((r) => [r, `rgb(var(--md-${r}) / <alpha-value>)`])
);

const config: Config = {
  content: ["./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    // M3 窗口尺寸类别：compact <600、medium 600–839、expanded ≥840、large ≥1200
    screens: {
      medium: "600px",
      expanded: "840px",
      large: "1200px",
    },
    container: {
      center: true,
      padding: "1rem",
      screens: { max: "1240px" },
    },
    extend: {
      colors,
      // M3 形状刻度：xs 4 / sm 8 / md 12 / lg 16 / xl 28 / full
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "28px",
      },
      // M3 阴影层级 1–3
      boxShadow: {
        "elevation-1": "0 1px 2px rgb(0 0 0 / 0.3), 0 1px 3px 1px rgb(0 0 0 / 0.15)",
        "elevation-2": "0 1px 2px rgb(0 0 0 / 0.3), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "elevation-3": "0 1px 3px rgb(0 0 0 / 0.3), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
      },
      fontFamily: {
        sans: ["Roboto", '"PingFang SC"', '"Noto Sans SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
      },
      // M3 字体刻度（字号 / 行高 / 字距）
      fontSize: {
        "display-small": ["36px", { lineHeight: "44px", letterSpacing: "0", fontWeight: "400" }],
        "headline-large": ["32px", { lineHeight: "40px", letterSpacing: "0", fontWeight: "400" }],
        "headline-medium": ["28px", { lineHeight: "36px", letterSpacing: "0", fontWeight: "400" }],
        "headline-small": ["24px", { lineHeight: "32px", letterSpacing: "0", fontWeight: "400" }],
        "title-large": ["22px", { lineHeight: "28px", letterSpacing: "0", fontWeight: "400" }],
        "title-medium": ["16px", { lineHeight: "24px", letterSpacing: "0.15px", fontWeight: "500" }],
        "title-small": ["14px", { lineHeight: "20px", letterSpacing: "0.1px", fontWeight: "500" }],
        "body-large": ["16px", { lineHeight: "24px", letterSpacing: "0.5px", fontWeight: "400" }],
        "body-medium": ["14px", { lineHeight: "20px", letterSpacing: "0.25px", fontWeight: "400" }],
        "body-small": ["12px", { lineHeight: "16px", letterSpacing: "0.4px", fontWeight: "400" }],
        "label-large": ["14px", { lineHeight: "20px", letterSpacing: "0.1px", fontWeight: "500" }],
        "label-medium": ["12px", { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" }],
        "label-small": ["11px", { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" }],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
