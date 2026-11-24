import {
  OtpError,
  otpError,
  otpErrorText,
  secondsLeft,
  totpStep,
  twoFactorFrom,
} from '../src/twoFactor';

const serverMessages = (message: string) =>
  JSON.stringify([JSON.stringify({message})]);

describe('twoFactorFrom', () => {
  it('reads the challenge from a two-factor answer', () => {
    expect(
      twoFactorFrom({
        verification: {method: 'OTP App', setup: true},
        tmp_id: 'abc',
      }),
    ).toEqual({tmpId: 'abc', setup: true, method: 'OTP App', prompt: ''});
  });
  it('knows an authenticator that is not set up yet', () => {
    expect(
      twoFactorFrom({
        verification: {method: 'OTP App', setup: false},
        tmp_id: 'abc',
      })?.setup,
    ).toBe(false);
  });
  it('is null for a one-step sign-in', () => {
    expect(twoFactorFrom({message: 'Logged In'})).toBeNull();
    expect(twoFactorFrom({tmp_id: 'abc'})).toBeNull(); // needs `verification` too
    expect(twoFactorFrom(undefined)).toBeNull();
  });
});

describe('otpError', () => {
  it('a wrong code', () => {
    const e = otpError(401, {
      exc_type: 'AuthenticationError',
      _server_messages: serverMessages('Incorrect Verification code'),
    });
    expect(e.kind).toBe('wrong');
    expect(otpErrorText(e, 'en')).toBe('Wrong code. Try the current one.');
  });
  it('an expired sign-in (500 ExpiredLoginException)', () => {
    expect(
      otpError(500, {
        exc_type: 'ExpiredLoginException',
        exception: 'Login session expired, refresh page to retry',
      }).kind,
    ).toBe('expired');
  });
  it('an expired sign-in (cached username gone)', () => {
    expect(otpError(401, {message: 'Incomplete login details'}).kind).toBe(
      'expired',
    );
  });
  it('another 4xx shows ERP text without HTML', () => {
    const e = otpError(403, {
      _server_messages: serverMessages('<b>Your account is locked</b>'),
    });
    expect(e.kind).toBe('other');
    expect(otpErrorText(e, 'en')).toBe('Your account is locked');
  });
  it('no connection or a 5xx is the generic network message', () => {
    expect(otpError(0, undefined).kind).toBe('network');
    expect(otpErrorText(otpError(502, {}), 'ar')).toBe(
      'تعذّر الوصول إلى ERP. تحقّق من اتصالك.',
    );
  });
  it('unknown errors read as network trouble', () => {
    expect(otpErrorText(new Error('x'), 'en')).toBe(
      "Can't reach ERP. Check your connection.",
    );
    expect(new OtpError('wrong')).toBeInstanceOf(Error);
  });
});

describe('code clock', () => {
  it('30-second steps', () => {
    expect(totpStep(29_999)).toBe(0);
    expect(totpStep(30_000)).toBe(1);
    expect(secondsLeft(0)).toBe(30);
    expect(secondsLeft(29_000)).toBe(1);
  });
});
