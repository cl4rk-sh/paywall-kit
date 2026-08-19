import { Text as RNText, TextProps as RNTextProps } from 'react-native';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'label' | 'link' | 'error';

export interface TextProps extends RNTextProps {
    variant?: TextVariant;
    className?: string;
    lastLineFix?: boolean;
}

export function Text({ variant = 'body', className = '', style, lastLineFix = true, children, ...props }: TextProps) {
    const variants = {
        h1: "text-3xl font-nunito-extra text-slate-700",
        h2: "text-2xl font-nunito-bold text-slate-700",
        h3: "text-lg font-nunito-bold text-slate-600",
        body: "text-base font-nunito-semi text-slate-500",
        label: "text-slate-400 font-nunito-extra uppercase tracking-widest text-sm",
        link: "text-sky font-nunito-bold",
        error: "text-gum text-sm font-nunito-bold",
    };

    // User classes come LAST to allow overriding without !important
    const combinedClassName = `${variants[variant]} ${className}`;

    let content = children;

    if (lastLineFix && typeof children === 'string') {
        const words = children.trim().split(' ');
        if (words.length > 3) {
            const lastWord = words.pop();
            const secondLastWord = words.pop();
            content = [...words, `${secondLastWord}\u00A0${lastWord}`].join(' ');
        }
    }

    return (
        <RNText
            className={combinedClassName}
            style={style}
            {...props}
        >
            {content}
        </RNText>
    );
}
