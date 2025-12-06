import { createJoplinService } from '../services/joplin-service.js';

export function registerJoplinRoutes(app, params) {
  const joplin = createJoplinService(params.config);

  app.get('/joplin', async (req, res) => {
    try {
      const notes = await joplin.listNotes();
      res.render('joplin/index.njk', { notes });
    } catch (err) {
      res.render('joplin/error.njk', { message: err.message });
    }
  });

  app.get('/joplin/note/:id', async (req, res) => {
    try {
      const note = await joplin.getNoteById(req.params.id);
      res.render('joplin/note.njk', { note });
    } catch (err) {
      res.render('joplin/error.njk', { message: err.message });
    }
  });

  app.get('/joplin/resource/:id', async (req, res) => {
    const downloadName = req.query.name || null;
    try {
      const resource = await joplin.getResourceById(req.params.id);
      if (!resource) {
        return res.status(404).send('Not found');
      }
      res.setHeader('Content-Type', resource.contentType);
      if (downloadName) {
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      }
      res.send(resource.data);
    } catch {
      res.status(500).send('Error loading resource');
    }
  });
}
