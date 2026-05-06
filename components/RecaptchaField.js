'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from '@/app/page.module.scss';

export default function RecaptchaField({ onVerify }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbackName = `onRecaptchaLoaded_${useId().replaceAll(':', '')}`;
  const [loadStatus, setLoadStatus] = useState('loading');
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const status = siteKey ? loadStatus : 'missing-key';

  useEffect(() => {
    if (!siteKey) {
      onVerify('');
      return;
    }

    function renderCaptcha() {
      if (!containerRef.current || !window.grecaptcha || widgetIdRef.current !== null) return;

      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
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

    window[callbackName] = renderCaptcha;

    if (window.grecaptcha?.render) {
      renderCaptcha();
      return () => {
        delete window[callbackName];
      };
    }

    let script = document.querySelector('script[data-recaptcha]');

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
      delete window[callbackName];
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
