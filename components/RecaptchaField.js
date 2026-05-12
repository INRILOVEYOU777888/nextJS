'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from '@/app/page.module.scss';

/**
 * @typedef {{
 *   render: (
 *     container: HTMLElement,
 *     options: {
 *       sitekey: string,
 *       callback: (token: string) => void,
 *       'expired-callback': () => void,
 *       'error-callback': () => void,
 *     }
 *   ) => number
 * }} RecaptchaApi
 */

/**
 * @returns {Window & typeof globalThis & Record<string, (() => void) | undefined> & { grecaptcha?: RecaptchaApi }}
 */
function recaptchaWindow() {
  return /** @type {Window & typeof globalThis & Record<string, (() => void) | undefined> & { grecaptcha?: RecaptchaApi }} */ (window);
}

/** @param {{ onVerify: (token: string) => void }} props */
export default function RecaptchaField({ onVerify }) {
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const widgetIdRef = useRef(/** @type {number | null} */ (null));
  const callbackName = `onRecaptchaLoaded_${useId().replaceAll(':', '')}`;
  const [loadStatus, setLoadStatus] = useState('loading');
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const status = siteKey ? loadStatus : 'missing-key';

  useEffect(() => {
    if (!siteKey) {
      onVerify('');
      return;
    }
    const recaptchaSiteKey = siteKey;

    function renderCaptcha() {
      const recaptcha = recaptchaWindow().grecaptcha;
      if (!containerRef.current || !recaptcha || widgetIdRef.current !== null) return;

      widgetIdRef.current = recaptcha.render(containerRef.current, {
        sitekey: recaptchaSiteKey,
        callback: (token) => {
          setLoadStatus('ready');
          onVerify(token);
        },
        'expired-callback': () => {
          setLoadStatus('ready');
          onVerify('');
        },
        'error-callback': () => {
          setLoadStatus('error');
          onVerify('');
        },
      });

      setLoadStatus('ready');
    }

    recaptchaWindow()[callbackName] = renderCaptcha;

    if (recaptchaWindow().grecaptcha?.render) {
      renderCaptcha();
      return () => {
        delete recaptchaWindow()[callbackName];
      };
    }

    let script = /** @type {HTMLScriptElement | null} */ (document.querySelector('script[data-recaptcha]'));

    if (!script) {
      script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
      script.async = true;
      script.defer = true;
      script.dataset.recaptcha = 'true';
      script.addEventListener('error', () => {
        setLoadStatus('error');
        onVerify('');
      });
      document.body.appendChild(script);
    } else {
      script.addEventListener('load', renderCaptcha, { once: true });
    }

    return () => {
      delete recaptchaWindow()[callbackName];
    };
  }, [callbackName, onVerify, siteKey]);

  return (
    <div className={styles.captchaShell}>
      <div className={styles.captcha} ref={containerRef} />
      {status === 'loading' && <p className={styles.captchaNote}>Загрузка reCAPTCHA...</p>}
      {status === 'missing-key' && <p className={styles.captchaError}>Не задан ключ reCAPTCHA</p>}
      {status === 'error' && <p className={styles.captchaError}>Не удалось загрузить reCAPTCHA</p>}
    </div>
  );
}
