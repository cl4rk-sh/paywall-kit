// Type declarations for ./palette.js — keep in sync with that file.

/** Full Tailwind-style scale (50–900) plus semantic light / DEFAULT / dark aliases. */
type BrandScale = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    light: string;
    DEFAULT: string;
    dark: string;
};

/** Neutral scale (50–950), no semantic aliases. */
type NeutralScale = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
};

/** Plain 50–900 scale (no aliases, no 950). */
type SimpleScale = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
};

export const gum: BrandScale;
export const orange: BrandScale;
export const sky: BrandScale;
export const sun: BrandScale;
export const purple: BrandScale;
export const teal: BrandScale;
export const success: BrandScale;
export const error: BrandScale;
export const warning: BrandScale;
export const slate: NeutralScale;
export const green: SimpleScale;
export const white: string;
export const black: string;
export const ui: {
    text_light: string;
    text_dark: string;
    bg_dark: string;
    icon_light: string;
    icon_dark: string;
};
