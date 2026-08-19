import Button from '@/components/ui/Button';
import { TileColor } from '@/components/ui/IconTile';
import { ComponentProps, forwardRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type GradientButtonProps = ComponentProps<typeof Button> & {
    label: string;
    color?: TileColor;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    style?: StyleProp<ViewStyle>;
    haptic?: 'selection' | 'impact-light' | 'none';
};

/**
 * The raised 3D gradient button. Now a thin wrapper over the unified `Button`
 * (variant="gradient") so there's a single button implementation; kept for the
 * many existing call sites and its convenient `color`/`label` API.
 */
export const GradientButton = forwardRef<View, GradientButtonProps>(({ color = 'orange', ...props }, ref) => {
    return <Button ref={ref} variant="gradient" color={color} {...props} />;
});

GradientButton.displayName = 'GradientButton';

export default GradientButton;
