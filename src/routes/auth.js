import { UserStore } from '../lib/user-store.js';

export function registerAuthRoutes(app, params = {}) {
  const name = params.config.name || 'auth';
  const basePath = params.config.basePath || '/auth';
  const loginView = `${name}/login.njk`;
  const profileView = `${name}/profile.njk`;
  const errorView = 'common/error.njk';

  const onLogin = params.onLogin;
  const onLogout = params.onLogout;

  const userStore = new UserStore();

  app.get(`${basePath}/login`, (req, res) => {
    const redirectTo = getSafeRedirect(req, `${basePath}/profile`);
    if (req.session?.user) {
      return res.redirect(redirectTo);
    }

    res.render(loginView, {
      basePath,
      title: 'Login',
      error: null,
      values: { username: '' },
      redirect: redirectTo
    });
  });

  app.post(`${basePath}/login`, async (req, res) => {
    const redirectTo = getSafeRedirect(req, `${basePath}/profile`);
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.render(loginView, {
        basePath,
        title: 'Login',
        error: 'Please enter username and password.',
        values: { username: username || '' },
        redirect: redirectTo
      });
    }

    try {
      const user = await userStore.findUser(username, password);
      if (!user) {
        return res.status(401).render(loginView, {
          basePath,
          title: 'Login',
          error: 'Invalid credentials.',
          values: { username },
          redirect: redirectTo
        });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        roles: user.roles || []
      };

      if (onLogin) {
        await onLogin.notifyAll({ req, res, user });
      }

      if (req.session?.user) {
        return res.redirect(redirectTo);
      }

      res.redirect(redirectTo);
    } catch (err) {
      console.error(err);
      res.status(500).render(errorView);
    }
  });

  app.get(`${basePath}/profile`, (req, res) => {
    if (!req.session?.user) {
      return res.redirect(`${basePath}/login`);
    }

    res.render(profileView, {
      basePath,
      title: 'Profile',
      user: req.session.user
    });
  });

  app.get(`${basePath}/logout`, async (req, res) => {
    if (onLogout) {
      await onLogout.notifyAll({ req, res });
    }

    req.session?.destroy(() => {
      res.redirect('/');
    });
  });
}

function getSafeRedirect(req, fallback) {
  const redirectRaw = req.query?.redirect || req.body?.redirect;
  return redirectRaw && redirectRaw.startsWith('/') ? redirectRaw : fallback;
}
