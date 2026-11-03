/** Shown on the audience page when the control room hasn't set a custom text. */
export const DEFAULT_AUDIENCE_TEXT = "Tap the button whenever you feel life";
export const AUDIENCE_TEXT_MAX = 280;

export const audienceTextOrDefault = (text: string | null | undefined) => text?.trim() || DEFAULT_AUDIENCE_TEXT;
