import {NativeModules, Platform} from 'react-native';

// ERPNext two-factor sign-in (Frappe v14), shared by the workspace sign-in (api.js)
// and Messenger's (messenger/session.tsx).
//
// 1. POST login {usr, pwd}. A user with the "Two Factor Login" role gets no session;
//    the body carries `tmp_id` and `verification` instead (that is how it's detected,
//    never by message text).
// 2. POST login {tmp_id, otp}. ERP finds the pending sign-in by tmp_id; on success it
//    starts the session exactly like a one-step sign-in.
//
// tmp_id, the password and the code live in memory only (component state / refs) and
// are never stored or logged.

export type TwoFactor = {
  tmpId: string;
  // false: the authenticator isn't set up yet; ERP e-mailed the QR-code link, and the
  // first correct code completes the setup.
  setup: boolean;
  method: string; // "OTP App" here; SMS / Email would work the same way
  prompt: string; // ERP's own hint, shown for the SMS / Email methods
};

const clean = (text: unknown) =>
  String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 300);

export function twoFactorFrom(body: any): TwoFactor | null {
  const tmpId = body?.tmp_id;
  const verification = body?.verification;
  if (!tmpId || typeof tmpId !== 'string') return null;
  if (!verification || typeof verification !== 'object') return null;
  return {
    tmpId,
    setup: verification.setup !== false,
    method: String(verification.method || 'OTP App'),
    prompt: clean(verification.prompt),
  };
}

// Thrown by a first-step sign-in that needs a code; carries what step 2 needs.
export class TwoFactorNeeded extends Error {
  constructor(readonly challenge: TwoFactor) {
    super('Enter the code from your authenticator app.');
  }
}

// ERP's user-facing message from an error body, without HTML or JSON.
export function erpMessage(body: any): string {
  try {
    const first = JSON.parse(body?._server_messages || '[]')[0];
    const parsed = first ? JSON.parse(first) : null;
    if (parsed?.message) return clean(parsed.message);
  } catch {
    /* not there */
  }
  if (typeof body?.message === 'string') return clean(body.message);
  return '';
}

export type OtpFailureKind = 'wrong' | 'expired' | 'network' | 'other';
export class OtpError extends Error {
  constructor(readonly kind: OtpFailureKind, message = '') {
    super(message);
  }
}

// What a failed step 2 means. status 0 = no answer (offline, timeout).
export function otpError(status: number, body: any): OtpError {
  const message = erpMessage(body);
  const type = String(body?.exc_type || body?.exception || '');
  // A tmp_id past its few minutes: Frappe raises ExpiredLoginException (a 500), or,
  // once the cached username is gone too, "Incomplete login details".
  if (
    /ExpiredLogin/i.test(type) ||
    /expired|incomplete login details/i.test(message)
  )
    return new OtpError('expired', message);
  if (!status) return new OtpError('network');
  if (/verification code|incorrect (otp|code)|invalid (otp|code)/i.test(message))
    return new OtpError('wrong', message);
  if (status >= 400 && status < 500)
    return message ? new OtpError('other', message) : new OtpError('wrong');
  return new OtpError('network');
}

// Authenticator codes change every 30 s.
export const totpStep = (at = Date.now()) => Math.floor(at / 30_000);
export const secondsLeft = (at = Date.now()) =>
  30 - (Math.floor(at / 1000) % 30);

// ---- Wording (English / Arabic) ----

export type Lang = 'en' | 'ar';

function deviceLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const found = settings?.AppleLocale || settings?.AppleLanguages?.[0];
      if (found) return String(found);
    } else {
      const found = NativeModules.I18nManager?.localeIdentifier;
      if (found) return String(found);
    }
  } catch {
    /* fall through */
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}
export const deviceLang = (): Lang =>
  /^ar\b|^ar[-_]/i.test(deviceLocale()) ? 'ar' : 'en';

export const OTP_TEXT = {
  en: {
    title: 'Two-step sign-in',
    enter: 'Enter the 6-digit code from your authenticator app',
    setupTitle:
      'Set up your authenticator app first: open the link we e-mailed you.',
    setupDetail:
      'Check your work e-mail for the link to set up your authenticator app, scan the QR code, then enter the 6-digit code here.',
    wrong: 'Wrong code. Try the current one.',
    expired: 'That took too long. Sign in again.',
    network: "Can't reach ERP. Check your connection.",
    verify: 'Verify',
    back: 'Back',
    placeholder: '6-digit code',
    countdown: (s: number) => `The code changes every 30 seconds · ${s}s left`,
    otherLang: 'العربية',
  },
  ar: {
    title: 'تسجيل الدخول بخطوتين',
    enter: 'أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة',
    setupTitle: 'فعّل تطبيق المصادقة أولًا: افتح الرابط الذي أرسلناه إلى بريدك.',
    setupDetail:
      'افتح بريد العمل، واضغط على رابط إعداد تطبيق المصادقة، وامسح رمز QR، ثم أدخل الرمز المكوّن من 6 أرقام هنا.',
    wrong: 'الرمز غير صحيح. جرّب الرمز الحالي.',
    expired: 'انتهت المهلة. سجّل الدخول مجددًا.',
    network: 'تعذّر الوصول إلى ERP. تحقّق من اتصالك.',
    verify: 'تحقّق',
    back: 'رجوع',
    placeholder: 'رمز من 6 أرقام',
    countdown: (s: number) => `يتغيّر الرمز كل 30 ثانية · متبقٍ ${s} ث`,
    otherLang: 'English',
  },
};

// The message for a failed step 2 in the chosen language (ERP's own text for "other").
export function otpErrorText(error: unknown, lang: Lang): string {
  const t = OTP_TEXT[lang];
  if (!(error instanceof OtpError)) return t.network;
  if (error.kind === 'wrong') return t.wrong;
  if (error.kind === 'expired') return t.expired;
  if (error.kind === 'network') return t.network;
  return error.message || t.wrong;
}
