import { loadUsers, findUser } from '../helpers/users.js';

export function registerAuthRoutes(app, params = {}) {
  const basePath = params.basePath || '/auth';
  const loginView = params.loginView || 'auth/login.njk';
  const profileView = params.profileView || 'auth/profile.njk';

  let users = loadUsers();

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

  app.post(`${basePath}/login`, (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.render(loginView, {
        basePath,
        title: 'Login',
        error: 'Please enter username and password.',
        values: { username: username || '' }
      });
    }

    const user = findUser(users, username, password);
    if (!user) {
      return res.render(loginView, {
        basePath,
        title: 'Login',
        error: 'Invalid credentials.',
        values: { username }
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      roles: user.roles || []
    };

    const redirectTo = getSafeRedirect(req, `${basePath}/profile`);
    if (req.session?.user) {
      return res.redirect(redirectTo);
    }

    res.redirect(redirectTo);
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

  app.get(`${basePath}/logout`, (req, res) => {
    req.session?.destroy(() => {
      res.redirect('/');
    });
  });

  app.post(`${basePath}/reload-users`, (req, res) => {
    users = loadUsers();
    res.redirect(`${basePath}/login`);
  });
}

function getSafeRedirect(req, fallback) {
  const redirectRaw = req.query?.redirect || req.body?.redirect;
  return redirectRaw && redirectRaw.startsWith('/') ? redirectRaw : fallback;
}
