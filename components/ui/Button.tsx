import { TileColor, tileGradient, tileTint } from '@/components/ui/IconTile';
import { coloredShadow, RADIUS } from '@/constants/designTokens';
import { slate, white } from '@/constants/palette';
import { useTapGuard } from '@/hooks/use-tap-guard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Loader2 } from 'lucide-react-native';
import { cloneElement, ComponentProps, forwardRef, isValidElement, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'outline' | 'white' | 'purple' | 'shimmer' | 'gradient' | 'soft';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'none';

type ButtonProps = ComponentProps<typeof Pressable> & {
    variant?: ButtonVariant;
    /** Brand color for gradient/soft variants (overrides the variant's implied color). */
    color?: TileColor;
    size?: ButtonSize;
    label?: string;
    className?: string;
    textClassName?: string;
    textStyle?: StyleProp<TextStyle>;
    isLoading?: boolean;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    children?: React.ReactNode;
    haptic?: 'selection' | 'impact-light' | 'impact-medium' | 'impact-heavy' | 'none';
    /**
     * When disabled, instead of the gray muted look, the button stays full-color but
     * fades + grows in once enabled (and fades/shrinks out when disabled again). Its
     * footprint is reserved either way, so layout never jumps. Used for onboarding
     * "Continue" buttons that appear once a selection is made.
     */
    revealOnEnable?: boolean;
};

// Old variant names → their modern brand color.
const VARIANT_COLOR: Partial<Record<ButtonVariant, TileColor>> = {
    primary: 'orange',
    secondary: 'sky',
    danger: 'gum',
    warning: 'sun',
    purple: 'purple',
};

const PAD: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number }> = {
    xs: { paddingVertical: 7, paddingHorizontal: 14 },
    sm: { paddingVertical: 11, paddingHorizontal: 18 },
    md: { paddingVertical: 15, paddingHorizontal: 22 },
    lg: { paddingVertical: 18, paddingHorizontal: 26 },
    none: { paddingVertical: 0, paddingHorizontal: 0 },
};

const TEXT_SIZE: Record<ButtonSize, string> = {
    xs: 'text-sm', sm: 'text-base', md: 'text-base', lg: 'text-xl', none: 'text-base',
};

/**
 * The single app button. Modern flat/soft + gradient aesthetic.
 * - gradient (default for colored variants): brand light→dark gradient + soft glow, white label
 * - outline / white: white pill, thin slate border, slate label
 * - soft: pale brand tint + brand label
 * - shimmer: translucent white (over images/gradients)
 * The legacy variant names (primary/secondary/danger/warning/purple) map onto the
 * gradient look so existing call sites modernize with no changes.
 */
const Button = forwardRef<View, ButtonProps>(
    ({
        className = '',
        textClassName = '',
        variant = 'primary',
        color,
        size = 'md',
        label,
        isLoading,
        icon,
        iconRight,
        children,
        onPress,
        haptic = 'impact-light',
        textStyle,
        style,
        disabled,
        revealOnEnable = false,
        ...props
    }, ref) => {
        const spinValue = useRef(new Animated.Value(0)).current;
        useEffect(() => {
            if (isLoading) {
                const anim = Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
                anim.start();
                return () => anim.stop();
            }
            spinValue.setValue(0);
        }, [isLoading]);
        const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

        const isFlat = variant === 'outline' || variant === 'white';
        const isShimmer = variant === 'shimmer';
        const isSoft = variant === 'soft';
        const isGradient = !isFlat && !isShimmer && !isSoft;

        const brand: TileColor = color ?? VARIANT_COLOR[variant] ?? 'orange';
        const grad = tileGradient(brand);
        const tint = tileTint(brand);

        const pad = PAD[size];
        const isDisabled = !!disabled || !!isLoading;
        // `disabled` => an unmistakable muted look (gray fill, gray text, no
        // gradient/glow). `isLoading` stays colored — it's an in-progress state,
        // not a muted one. In `revealOnEnable` mode we never mute: the button is
        // full-color and simply hidden (faded/shrunk) until it's enabled.
        const isMuted = !!disabled && !isLoading && !revealOnEnable;

        // Reveal animation: 0 = hidden (disabled), 1 = shown (enabled).
        const reveal = useRef(new Animated.Value(disabled ? 0 : 1)).current;
        useEffect(() => {
            if (!revealOnEnable) return;
            Animated.spring(reveal, {
                toValue: disabled ? 0 : 1,
                useNativeDriver: true,
                damping: 13,
                stiffness: 170,
                mass: 0.7,
            }).start();
        }, [disabled, revealOnEnable]);
        const revealOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        const revealScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

        const fg = isMuted ? slate[500] : isGradient ? white : isShimmer ? white : isSoft ? tint : slate[700];

        const allowTap = useTapGuard();
        const handlePress = (e: any) => {
            if (isDisabled) return;
            if (!allowTap()) return; // ignore a fast double-tap (double haptic + action)
            if (haptic === 'selection') Haptics.selectionAsync();
            else if (haptic === 'impact-light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            else if (haptic === 'impact-medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            else if (haptic === 'impact-heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onPress?.(e);
        };

        const loaderColor = isGradient || isShimmer ? white : tint;

        // When muted, recolor passed icons to match the muted label. Override
        // `fill` only when the icon was already filled (so stroke-only icons
        // don't get unexpectedly filled in).
        const tintIcon = (node: React.ReactNode): React.ReactNode => {
            if (!isMuted || !isValidElement(node)) return node;
            const p = node.props as { fill?: unknown };
            const next: { color: string; fill?: string } = { color: fg };
            if (p.fill !== undefined && p.fill !== 'none' && p.fill) next.fill = fg;
            return cloneElement(node, next as any);
        };

        // Flat (outline/white/soft/shimmer) fill applied directly to the Pressable
        // so className sizing (w-full / h-full) sizes the colored area.
        const flatStyle: ViewStyle = isShimmer
            ? { backgroundColor: 'rgba(255,255,255,0.2)' }
            : isSoft
                ? { backgroundColor: softTint(brand) }
                : variant === 'white'
                    ? { backgroundColor: white, borderWidth: 1, borderColor: slate[200] }
                    : { backgroundColor: 'transparent', borderWidth: 1, borderColor: slate[200] };

        const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
            { borderRadius: RADIUS.md, opacity: isMuted ? 1 : isLoading ? 0.7 : pressed ? 0.9 : 1, alignItems: 'center', justifyContent: 'center' },
            isMuted ? null : isGradient ? coloredShadow(grad[2], 0.4) : flatStyle,
            style as ViewStyle,
        ];

        const pressable = (
            <Pressable ref={ref} onPress={handlePress} disabled={isDisabled} className={className} style={pressableStyle} {...props}>
                {/* Gradient fill sits behind the content and fills the (possibly
                    className-sized) button; the content defines the size otherwise. */}
                {isGradient && !isMuted && (
                    <LinearGradient
                        colors={grad}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.md }]}
                        pointerEvents="none"
                    />
                )}
                {isMuted && (
                    <View
                        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.md, backgroundColor: slate[200] }]}
                        pointerEvents="none"
                    />
                )}
                <View style={{ ...pad, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} pointerEvents="none">
                    {tintIcon(icon)}
                    {label ? (
                        <Text
                            className={`text-center ${TEXT_SIZE[size]} ${textClassName}`}
                            style={[{ fontFamily: 'Nunito_800ExtraBold', color: fg }, textStyle]}
                        >
                            {label}
                        </Text>
                    ) : children}
                    {isLoading && (
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Loader2 size={20} color={loaderColor} />
                        </Animated.View>
                    )}
                    {tintIcon(iconRight)}
                </View>
            </Pressable>
        );

        if (!revealOnEnable) return pressable;

        // Fade + grow the button in/out as it enables; the wrapper keeps the same
        // footprint (transforms/opacity don't reflow) so the footer never jumps.
        return (
            <Animated.View style={{ opacity: revealOpacity, transform: [{ scale: revealScale }] }}>
                {pressable}
            </Animated.View>
        );
    }
);

Button.displayName = 'Button';

// Pale brand tint for the soft variant (color-100 equivalent).
function softTint(color: TileColor): string {
    const map: Record<TileColor, string> = {
        orange: '#ffedd5', sky: '#e0f2fe', purple: '#f3e8ff', sun: '#fef9c3', teal: '#ccfbf1', gum: '#ffe4e6',
    };
    return map[color];
}

export default Button;
