export const ALL_WA_PATCH_NAMES = [
    'critical_block',
    'critical_unblock_low',
    'regular_high',
    'regular_low',
    'regular'
];
/**
 * Flows (entry points) from which a chat can be reported as spam.
 * CLEAN-BAILEYS ADDITION — upstream @whiskeysockets/baileys 7.0.0-rc14 has no
 * spam-report API and no SPAM_FLOWS constant.
 *
 * UNCERTAINTY (read before trusting this): the wire value of each flow is
 * best-effort and UNVERIFIED against a live WhatsApp server. Only the key
 * name (OverflowMenuReport) comes from the public protocol description; the
 * snake_case wire value below is our reconstruction. If the server rejects
 * the stanza, reportSpam() throws instead of pretending success, and the
 * caller can pass any flow string explicitly via options.flow to override it.
 */
export const SPAM_FLOWS = Object.freeze({
    /** Report from the chat overflow menu (the normal "Report contact" path). */
    OverflowMenuReport: 'overflow_menu_report'
});
//# sourceMappingURL=Chat.js.map