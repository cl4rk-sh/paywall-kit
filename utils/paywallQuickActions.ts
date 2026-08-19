import * as QuickActions from 'expo-quick-actions';
import { Platform } from 'react-native';

/**
 * Adds a special offer quick action for the user.
 * This should be called when a paywall is shown.
 */
export const addSpecialOfferQuickAction = async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    try {
        await QuickActions.setItems([
            {
                // iOS shows the SF Symbol gift icon, so keep the emoji out of the
                // title there. Android uses the drawable declared as `gift_icon`
                // in the expo-quick-actions plugin config (app.json).
                title: Platform.OS === "ios"
                    ? "🎁 Wait! We have a special offer for you."
                    : "Wait! We have a special offer for you.",
                icon: Platform.OS === "ios" ? "symbol:gift" : "gift_icon",
                id: "special_offer",
                params: { href: "/paywall-promo" }, // Point to the dedicated promo paywall
            },
        ]);
        console.log('Special offer quick action added');
    } catch (error) {
        console.error('Failed to add quick action:', error);
    }
};

/**
 * Removes the special offer quick action.
 * This should be called when the paywall is dismissed or purchased.
 */
export const removeSpecialOfferQuickAction = async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    try {
        await QuickActions.setItems([]);
        console.log('Quick actions cleared');
    } catch (error) {
        console.error('Failed to remove quick action:', error);
    }
};

// Identifies the post-subscribe feedback quick action in cold-start / runtime
// handlers (see app/_layout.tsx).
export const FEEDBACK_QUICK_ACTION_ID = 'feedback';

// Tally feedback form opened by the "Something wrong?" quick action.
// The RevenueCat app user ID is appended as the `?id=` hidden field at tap
// time (see app/_layout.tsx). Add a matching "id" hidden field in the Tally
// form so the value is captured.
export const FEEDBACK_FORM_URL = 'https://tally.so/r/EkAA44';

/**
 * Adds the "Something wrong?" feedback quick action shown to subscribed /
 * trialing users. Call once the user has an active entitlement.
 *
 * NOTE: setItems replaces the entire quick-action list, so this also clears
 * the special offer action — which is what we want post-subscribe.
 */
export const addFeedbackQuickAction = async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    try {
        await QuickActions.setItems([
            {
                id: FEEDBACK_QUICK_ACTION_ID,
                title: '🕵 Something wrong?',
                // subtitle is iOS-only; Android shows the title alone.
                subtitle: 'Please leave us feedback before deleting the app.',
                icon: Platform.OS === 'ios' ? 'symbol:questionmark.circle' : undefined,
                // No href on purpose — the Tally form is external, so we open it
                // in the browser from a listener rather than routing in-app.
                params: { url: FEEDBACK_FORM_URL },
            },
        ]);
        console.log('Feedback quick action added');
    } catch (error) {
        console.error('Failed to add feedback quick action:', error);
    }
};
