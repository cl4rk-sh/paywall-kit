import { slate } from './palette';

/**
 * Shared design tokens so shadows, radii, and elevations are defined once and
 * reused everywhere (cards, buttons, chips, sheets) instead of being duplicated
 * inline across screens.
 */

/** Standard horizontal page padding. */
export const PAGE_PADDING_X = 20;

/**
 * Cap on how wide a screen's content column may grow (tablets). Phones are
 * narrower than this, so it is a no-op there. Apply via <ContentColumn>.
 */
export const MAX_CONTENT_WIDTH = 680;

/**
 * Bottom scroll padding for the main TAB screens so content clears the tab bar.
 * Was 120 when the bar had a raised Play button poking 22pt above it; the bar is
 * flat now and measures ~52pt plus the safe-area inset.
 */
export const TAB_SCROLL_PADDING_BOTTOM = 96;

/**
 * Bottom scroll padding for pushed full screens — ADD this to the safe-area
 * inset: `paddingBottom: insets.bottom + SCREEN_SCROLL_PADDING_BOTTOM`.
 */
export const SCREEN_SCROLL_PADDING_BOTTOM = 28;

/**
 * Header system. "Standard" headers are plain white (no radius/shadow).
 * "Elevated" headers (anything with content below the back row — a progress bar,
 * subtitle, sort row, etc.) get a rounded bottom + this drop shadow. When an
 * elevated header collapses on scroll, animate the radius HEADER_RADIUS → 0 but
 * keep SHADOW_HEADER constant.
 */
export const HEADER_RADIUS = 28;

// Corner radii (px).
export const RADIUS = {
    sm: 12,
    md: 16,
    lg: 24,
    xl: 36,
    pill: 999,
} as const;

// The standard soft card shadow used by every white card/group.
export const SHADOW_CARD = {
    shadowColor: slate[900],
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
} as const;

// The drop shadow under an elevated header. Stays constant while the radius
// animates on collapse.
export const SHADOW_HEADER = {
    shadowColor: slate[900],
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
} as const;

// A lighter shadow for subtle inset cards.
export const SHADOW_SOFT = {
    shadowColor: slate[900],
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
} as const;

/** A colored "raised" shadow tinted to a brand color (buttons, selected chips). */
export function coloredShadow(color: string, opacity = 0.3) {
    return {
        shadowColor: color,
        shadowOpacity: opacity,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    };
}
