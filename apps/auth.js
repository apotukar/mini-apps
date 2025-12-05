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
      const user = await findUser(users, username, password);
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

      if (req.session?.user) {
        return res.redirect(redirectTo);
      }

      res.redirect(redirectTo);
    } catch (err) {
      console.error(err);
      res.status(500).render('common/error.njk');
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

  app.get(`${basePath}/logout`, (req, res) => {
    req.session?.destroy(() => {
      res.redirect('/');
    });
  });

  app.post(`${basePath}/reload-users`, async (req, res) => {
    users = loadUsers();
    res.redirect(`${basePath}/login`);
  });
}

function getSafeRedirect(req, fallback) {
  const redirectRaw = req.query?.redirect || req.body?.redirect;
  return redirectRaw && redirectRaw.startsWith('/') ? redirectRaw : fallback;
}
