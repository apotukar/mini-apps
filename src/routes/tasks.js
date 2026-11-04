import { OAuthReauthRequiredError } from '../errors.js';

export function registerTaskRoutes(app, _) {
  app.get('/tasks', async (req, res) => {
    try {
      const userName = req.session?.user?.username;
      const tasksService = req.services.get('tasksService');
      const results = await tasksService.fetchTasksForUser(userName);

      delete req.session.googleOAuth;
      res.render('tasks/index.njk', {
        lists: results
      });
    } catch (err) {
      if (err instanceof OAuthReauthRequiredError && err.provider === 'google') {
        return res.redirect('/auth/google');
      }
      console.error(err);
      res.status(500).render('common/error.njk');
    }
  });
}
