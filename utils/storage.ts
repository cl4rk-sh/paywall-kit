/**
 * Minimal settings store for the paywall kit.
 *
 * The source app has a much larger settings module covering its own domain
 * model; only the two fields below are read or written by the paywall, so this
 * is a trimmed standalone version. If you already have a settings layer,
 * delete this file and point the two imports at yours — the paywall only needs
 * `getAppSettings` / `saveAppSettings` with these keys.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'APP_SETTINGS';

export interface AppSettings {
    /**
     * How many days before the trial ends the user asked to be reminded.
     * Chosen on paywall-sequence/page2; the paywall WebView reads it back so
     * the trial timeline can name the exact day the user just picked.
     */
    trialReminderDaysBefore?: number;
}

const DEFAULTS: AppSettings = {
    trialReminderDaysBefore: 2,
};

export async function getAppSettings(): Promise<AppSettings> {
    try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
        // Corrupt or unreadable storage must not block the paywall rendering.
        return { ...DEFAULTS };
    }
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<void> {
    try {
        const current = await getAppSettings();
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
    } catch {
        // Non-fatal: the reminder preference is a nicety, not a gate.
    }
}
