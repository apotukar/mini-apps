export function registerJoplinRoutes(app, _) {
  // TODO: route
  // const route = params.route || {};

  app.get('/joplin', async (req, res) => {
    try {
      const joplinService = req.services.get('joplinService');
      const notes = await joplinService.listNotes();
      res.render('joplin/index.njk', { notes });
    } catch (error) {
      console.log(error);
      res.render('joplin/error.njk', { message: error.message });
    }
  });

  app.get('/joplin/note/:id', async (req, res) => {
    try {
      const joplinService = req.services.get('joplinService');
      const note = await joplinService.getNoteById(req.params.id);
      res.render('joplin/note.njk', { note });
    } catch (error) {
      console.log(error);
      res.render('joplin/error.njk', { message: error.message });
    }
  });

  app.get('/joplin/resource/:id', async (req, res) => {
    const downloadName = req.query.name || null;
    try {
      const joplinService = req.services.get('joplinService');
      const resource = await joplinService.getResourceById(req.params.id);
      if (!resource) {
        return res.status(404).send('Not found');
      }
      res.setHeader('Content-Type', resource.contentType);
      if (downloadName) {
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      }
      res.send(resource.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Error loading resource');
    }
  });
}
