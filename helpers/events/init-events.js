import { loginObservable } from './login-observable.js';
import { logoutObservable } from './logout-observable.js';
import { createMergeFavoritesOnLogin } from './favorites-on-login.js';
import { createMergeFavoritesOnLogout } from './favorites-on-logout.js';

export const initEvents = config => {
  loginObservable.subscribe(createMergeFavoritesOnLogin(config));
  logoutObservable.subscribe(createMergeFavoritesOnLogout(config));
};
