// js/services/native.js
// Bridges the Capacitor native Android APIs into the web layer.
// Gracefully degrades to browser APIs when running as a plain PWA/website.

const BACKEND = 'https://jembebackend.onrender.com/api';

let _Camera = null;
let _Network = null;
let _App = null;
let _Push = null;
let _Preferences = null;
let _isNative = false;

async function init() {
  try {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;
    _isNative = true;

    const [cam, net, app, push, prefs] = await Promise.all([
      import('@capacitor/camera').catch(() => null),
      import('@capacitor/network').catch(() => null),
      import('@capacitor/app').catch(() => null),
      import('@capacitor/push-notifications').catch(() => null),
      import('@capacitor/preferences').catch(() => null),
    ]);

    _Camera      = cam?.Camera;
    _Network     = net?.Network;
    _App         = app?.App;
    _Push        = push?.PushNotifications;
    _Preferences = prefs?.Preferences;

    _setupNetwork();
    _setupBackButton();
    _setupPush();

    console.log('[native] Capacitor ready on', Capacitor.getPlatform());
  } catch (err) {
    console.warn('[native] Could not load Capacitor plugins:', err.message);
  }
}

// ---- Network monitoring ----
function _setupNetwork() {
  if (!_Network) return;
  _Network.addListener('networkStatusChange', ({ connected }) => {
    const banner = document.getElementById('offlineBanner');
    if (banner) banner.style.display = connected ? 'none' : 'flex';
  });
}

// ---- Hardware back button ----
function _setupBackButton() {
  if (!_App) return;
  _App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack || window.location.hash === '#/feed' || window.location.hash === '') {
      _App.exitApp();
    } else {
      window.history.back();
    }
  });
}

// ---- Push notifications ----
function _setupPush() {
  if (!_Push) return;

  _Push.requestPermissions().then(({ receive }) => {
    if (receive === 'granted') _Push.register();
  });

  _Push.addListener('registration', ({ value: fcmToken }) => {
    const authToken = localStorage.getItem('fc_token');
    if (authToken && fcmToken) {
      fetch(`${BACKEND}/users/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token: fcmToken, platform: 'android' }),
      }).catch(() => {});
    }
  });

  _Push.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const path = notification.data?.path || '/feed';
    window.location.hash = path;
  });
}

// ---- Camera ----
async function takePhoto() {
  if (!_Camera) return null;
  try {
    const { CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await _Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    return photo.dataUrl;
  } catch (err) {
    if (!err.message?.includes('cancelled')) console.error('[native] camera:', err.message);
    return null;
  }
}

async function pickPhoto() {
  if (!_Camera) return null;
  try {
    const { CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await _Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
    return photo.dataUrl;
  } catch (_) {
    return null;
  }
}

// ---- Preferences (persistent storage, survives app restarts) ----
async function setItem(key, value) {
  if (_Preferences) {
    await _Preferences.set({ key, value: JSON.stringify(value) });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function getItem(key) {
  if (_Preferences) {
    const { value } = await _Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  }
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}

// Auto-init
init();

export const native = {
  isNative: () => _isNative,
  takePhoto,
  pickPhoto,
  setItem,
  getItem,
};
