export function registerTaskRoutes(app, _) {
  app.get('/tasks', async (req, res) => {
    try {
      const userName = req.session?.user?.username;
      const tasksService = req.services.get('tasksService');
      const results = await tasksService.fetchTasksForUser(userName);

      res.render('tasks/index.njk', {
        lists: results
      });
    } catch (err) {
      console.error(err);
      res.status(500).render('common/error.njk');
    }
  });
}
