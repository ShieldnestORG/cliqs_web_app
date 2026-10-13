/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "0.75in" },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Coherence Daddy typography — Geist everywhere, per the portal.
        // `heading` stays as a separate key because ~104 call sites use
        // font-heading; it now resolves to Geist rather than Space Grotesk.
        sans: [
          "Geist",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        heading: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
        body: ["Geist", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        // UI4 Typography Scale
        micro: ["0.625rem", { lineHeight: "1" }], // 10px
        label: ["0.75rem", { lineHeight: "1.25" }], // 12px
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }], // 13px
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // House-style button/menu tokens: gradient start, pressed fill, menu-row wash
          sheen: "hsl(var(--primary-sheen))",
          press: "hsl(var(--primary-press))",
          soft: "hsl(var(--primary-soft))",
          // Coral as TEXT: the coral itself on dark, the darker twin on light (coral on white is 2.6:1)
          text: "hsl(var(--primary-text))",
          "text-hover": "hsl(var(--primary-text-hover))",
        },
        // Control fill and the visible control edge (select, secondary button)
        field: "hsl(var(--field))",
        interactive: "hsl(var(--border-interactive))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          // Pressed fill and edge of the red button
          press: "hsl(var(--destructive-press))",
          // Status kit (the house style's five tokens per kind): DEFAULT = the colour as text on the page,
          // foreground = the label on a fill, mark = a solid fill or icon, soft = a wash, edge = a 1px border
          mark: "hsl(var(--destructive-mark))",
          soft: "hsl(var(--destructive-soft))",
          edge: "hsl(var(--destructive-edge))",
        },
        // Pressed fill of the ink (`action`) button
        ink: {
          press: "hsl(var(--ink-press))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Semantic status colours: the house style's status set, through styles/house-style.bridge.css.
        // success is the real green; green-accent is coral despite its name.
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          mark: "hsl(var(--success-mark))",
          soft: "hsl(var(--success-soft))",
          edge: "hsl(var(--success-edge))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          mark: "hsl(var(--warning-mark))",
          soft: "hsl(var(--warning-soft))",
          edge: "hsl(var(--warning-edge))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          mark: "hsl(var(--info-mark))",
          soft: "hsl(var(--info-soft))",
          edge: "hsl(var(--info-edge))",
        },
        // UI4 Accent Colors
        green: {
          accent: "hsl(var(--accent-green))",
          bright: "hsl(var(--accent-green-bright))",
        },
        purple: {
          accent: "hsl(var(--accent-purple))",
        },
        bronze: {
          DEFAULT: "hsl(var(--accent-bronze))",
          foreground: "hsl(var(--accent-bronze-foreground))",
        },
        // Coherence Daddy Accent Colors
        blue: {
          accent: "hsl(var(--accent-blue))",
        },
        gold: {
          accent: "hsl(var(--accent-gold))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        // The coral button: a 135deg sheen -> coral -> press
        "primary-gradient":
          "linear-gradient(135deg, hsl(var(--primary-sheen)) 0%, hsl(var(--primary)) 45%, hsl(var(--primary-press)) 100%)",
        // The same recipe in ink (`action`) and in red (`destructive`)
        "ink-gradient":
          "linear-gradient(135deg, hsl(var(--ink-sheen)) 0%, hsl(var(--foreground)) 45%, hsl(var(--ink-press)) 100%)",
        "destructive-gradient":
          "linear-gradient(135deg, hsl(var(--destructive-sheen)) 0%, hsl(var(--destructive-mark)) 45%, hsl(var(--destructive-press)) 100%)",
      },
      // House-style control motion: duration-ui / ease-ui (120ms, cubic-bezier(.2,.6,.2,1))
      transitionDuration: {
        ui: "var(--dur-ui)",
      },
      transitionTimingFunction: {
        ui: "var(--ease-ui)",
      },
      boxShadow: {
        // House-style popover shadow: menus and the coral button's hover
        pop: "var(--shadow-pop)",
        // Button depth: rest, hover, pressed, and the quiet one for outline / secondary
        btn: "var(--shadow-btn)",
        "btn-hover": "var(--shadow-btn-hover)",
        "btn-pressed": "var(--shadow-btn-pressed)",
        "btn-quiet": "var(--shadow-btn-quiet)",
        // UI4 Shadow System
        card: "var(--hs-shadow-1), var(--hs-edge-light)",
        "card-hover": "var(--hs-shadow-md)",
        "focus-ring": "var(--hs-ring)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: 0, transform: "translateX(10px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: 0, transform: "scale(0.95)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        "status-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--accent-green) / 0.4)" },
          "50%": { boxShadow: "0 0 0 4px hsl(var(--accent-green) / 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "status-pulse": "status-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
