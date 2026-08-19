import { gum, orange, purple, sky, sun, teal } from '@/constants/palette';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, View, ViewStyle } from 'react-native';

export type TileColor = 'orange' | 'sky' | 'purple' | 'sun' | 'teal' | 'gum';

// Same 3D treatment as the nav-bar Play button: a light → DEFAULT → dark
// gradient plus a colored drop shadow (in the brand's dark shade) so the tile
// reads as a raised, glowing element against light backgrounds.
// `base` is the canonical solid brand color; `soft` is the pale tile/pill background.
const tileColors: Record<TileColor, { base: string; soft: string }> = {
    orange: { base: orange.DEFAULT, soft: orange[100] },
    sky:    { base: sky.DEFAULT,    soft: sky[100] },
    purple: { base: purple.DEFAULT, soft: purple[100] },
    sun:    { base: sun.dark,       soft: sun[100] },
    teal:   { base: teal.DEFAULT,   soft: teal[100] },
    gum:    { base: gum.DEFAULT,    soft: gum[100] },
};

// Mix a hex color toward white (amt > 0) or black (amt < 0) by a small fraction.
function shade(hex: string, amt: number): string {
    const h = hex.replace('#', '');
    const target = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const mix = (c: number) => Math.round((target - c) * p + c).toString(16).padStart(2, '0');
    return `#${mix(parseInt(h.slice(0, 2), 16))}${mix(parseInt(h.slice(2, 4), 16))}${mix(parseInt(h.slice(4, 6), 16))}`;
}

/** The brand tint to color an icon with when using the `soft` variant. */
export function tileTint(color: TileColor) {
    return tileColors[color].base;
}

/** The opaque pale brand background used by the `soft` variant (brand 100). */
export function tileSoft(color: TileColor) {
    return tileColors[color].soft;
}

/**
 * The shared 3D gradient. The depth comes from a bright highlight at the TOP
 * (as if light catches the raised top edge) rather than from a dark bottom:
 * darkening the bottom toward black muddies the hue and reads as a dirty/grayish
 * bottom edge, so the bottom stop is kept close to the base on purpose. This
 * keeps a glossy, clearly-raised feel while the bottom stays a clean brand color.
 */
export function tileGradient(color: TileColor): [string, string, string] {
    const base = tileColors[color].base;
    return [shade(base, 0.18), base, shade(base, -0.05)];
}

type IconTileProps = {
    color?: TileColor;
    size?: number;
    /** Corner radius. Defaults to a soft squircle proportional to size. */
    radius?: number;
    /**
     * gradient → glossy raised tile (light→dark gradient) matching the Play button.
     * solid    → flat solid brand fill (no gradient, no glow); pair with a white icon.
     * soft     → flat pale tile; pair with a brand-tinted icon (see tileTint).
     */
    variant?: 'gradient' | 'solid' | 'soft';
    /** When true (gradient only), casts a soft colored glow. */
    glow?: boolean;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

export function IconTile({
    color = 'orange',
    size = 52,
    radius,
    variant = 'gradient',
    glow = true,
    children,
    style,
}: IconTileProps) {
    const c = tileColors[color];
    const grad = tileGradient(color);
    const r = radius ?? Math.round(size * 0.32);

    if (variant === 'soft' || variant === 'solid') {
        return (
            <View
                style={[
                    {
                        width: size,
                        height: size,
                        borderRadius: r,
                        backgroundColor: variant === 'soft' ? c.soft : c.base,
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    style,
                ]}
            >
                {children}
            </View>
        );
    }

    return (
        <View
            style={[
                glow && {
                    shadowColor: grad[2],
                    shadowOpacity: 0.22,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 5,
                    borderRadius: r,
                },
                style,
            ]}
        >
            <LinearGradient
                colors={grad}
                start={{ x: 0.35, y: 0 }}
                end={{ x: 0.65, y: 1 }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: r,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {children}
            </LinearGradient>
        </View>
    );
}

export default IconTile;
