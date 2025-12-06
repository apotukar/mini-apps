import { loginObservable } from './on-login/login-observable.js';
import { logoutObservable } from './on-logout/logout-observable.js';
import { createMergeFavoritesOnLogin } from './on-login/favorites-on-login.js';
import { createMergeFavoritesOnLogout } from './on-logout/favorites-on-logout.js';

export const createObservables = config => {
  loginObservable.addObserver(createMergeFavoritesOnLogin(config));
  logoutObservable.addObserver(createMergeFavoritesOnLogout(config));

  return {
    onLogin: loginObservable,
    onLogout: logoutObservable
  };
};
