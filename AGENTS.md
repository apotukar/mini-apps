# Hinweise für Coding-Agenten

## Kommunikation und Arbeitsweise

- Antworte auf Deutsch, kurz und konkret.
- Lies betroffene Dateien, bevor du Änderungen vornimmst. Prüfe den Git-Status und respektiere vorhandene Änderungen des Nutzers.
- Halte Änderungen auf den angefragten Umfang begrenzt. Keine beiläufigen Refactorings, Dependency-Upgrades oder projektweiten Formatierungen.
- Im Plan-Modus nur prüfen und besprechen, keine Dateien verändern.
- Keine Commits, Deployments, Container-Neustarts oder destruktiven Git-Befehle ohne ausdrücklichen Auftrag.
- Keine Geheimnisse aus `.env`, Tokens oder Zertifikaten ausgeben oder in Tests übernehmen.

## Ausführungsumgebung

- Projektpfad: `/home/apotukar/Workdir/mini-apps`.
- `npm`- und `npx`-Befehle dürfen ohne erneute Rückfrage direkt im lokalen Projektverzeichnis ausgeführt werden, statt über SSH auf `jetson`. Das gilt insbesondere für Tests, ESLint und Prettier. Beispiel:

  ```sh
  npm run test
  ```

- Andere umgebungsabhängige Befehle standardmäßig über SSH auf `jetson` im Compose-Service `node` ausführen, sofern der Nutzer nichts anderes vorgibt.
- Ist `jetson` nicht erreichbar, den Fehler melden und bei diesen Befehlen nicht ungefragt auf eine andere Umgebung ausweichen. Lokale `npm`- und `npx`-Prüfungen bleiben erlaubt.
- Docker-Builds, Image-Pulls und Neustarts sind keine Voraussetzung für reine Quelltextänderungen. Vor Ausführung den Auftrag und mögliche Auswirkungen prüfen.

## Projektstruktur und Stil

- Node.js mit ES-Modulen (`import`/`export`); vorhandene Namensgebung und Formatierung beibehalten.
- `src/routes/`: HTTP-Routen und Verarbeitung von Anfrageparametern.
- `src/services/`: Fachlogik und externe Dienste.
- `src/service-registry/`: Registrierung und Konfiguration der Dienste.
- `src/lib/`: gemeinsame Hilfsfunktionen und Adapter.
- `src/views/default/`: reguläre Nunjucks-Views (`.njk`).
- `src/views/ns4/`: Legacy-Views (`.ns4`).
- `tests/`: Tests mit dem eingebauten Node.js-Test-Runner.

## Views und Legacy-Unterstützung

- Bei Änderungen an Formularen und Darstellung prüfen, ob eine entsprechende NS4-View existiert, und diese analog anpassen.
- Das bestehende Tabellenlayout und die Legacy-Browser-Kompatibilität erhalten. Kein modernes Browser-JavaScript ungeprüft in NS4-Views übernehmen.
- Formularwerte und sichtbare Beschriftungen unterscheiden: Radius intern in Kilometern, unter 1 km als Meter anzeigen (`0.3` → `300 m`).
- Ausgewählte Werte beim Rendern und in zugehörigen Links erhalten. Standardwerte zwischen Route, Service und Templates konsistent halten.
- Template-Ausgaben und URL-Parameter passend escapen beziehungsweise kodieren.
- View-Tests für Standard- und Legacy-Ansichten sowie für relevante bedingte Anzeigen ergänzen.

## Abfahrten

- Bibliothek: `@motis-project/motis-fptf-client`.
- Anpassungen an API-Anfragen über den Profiladapter in `src/lib/transport-profile.js`; niemals `node_modules` editieren.
- Radius: Formular und Service verwenden Kilometer, API-Anfragen Meter. Standard ist `0.3 km` beziehungsweise `300 m`.
- Koordinaten können unter `station.location` oder direkt am Objekt liegen. Nicht ausschließlich anhand von `type` filtern; auch `station` und `stop` berücksichtigen. Null ist eine gültige Koordinate.
- Zunächst 30 Minuten ab Suchzeit abfragen. Bei weniger als zehn passenden Abfahrten in weiteren 30-Minuten-Fenstern suchen, insgesamt höchstens sechs Stunden.
- Höchstens zehn Abfahrten nach Radiusfilterung, Deduplizierung und chronologischer Sortierung anzeigen. Keine vorzeitige clientseitige Ergebnisbegrenzung.
- Fenstergrenzen, Mitternacht, leere Antworten, ungültige Zeitwerte und geplante Zeiten ohne Echtzeitangaben testen.
- Bei Änderungen an früheren/späteren Abfahrten sowohl die Zeitberechnung als auch die tatsächlich in der View übergebenen Parameter prüfen.

## Dependencies und Docker

- Sicherheitsprüfung für Produktionsabhängigkeiten: `npm audit --omit=dev`.
- Kein `npm audit fix --force` und keine Major-Upgrades ohne ausdrückliche Zustimmung.
- Gezielt angefragte Updates durchführen und die Lockdatei synchron halten. Vorhandene Overrides nicht ungeprüft entfernen; neue Overrides eng begrenzen und ihre Kompatibilität testen.
- `Dockerfile` und `.nvmrc` verwenden derzeit Node 24. Bei einem beauftragten Node-Major-Upgrade beide gemeinsam prüfen.
- Bei Node-Upgrades native Module wie `argon2` und `sharp` sowie Chromium/Puppeteer berücksichtigen. Das eingebundene Projektverzeichnis enthält möglicherweise alte `node_modules`.
- Redis verwendet persistente Daten. Versionswechsel, Datenmigration und Wiederherstellung nicht ohne vorherige Prüfung und Sicherung durchführen.

## Prüfungen und Abschluss

- Projektweite automatische Korrekturen bei entsprechendem Auftrag nacheinander ausführen:

  ```sh
  npm run lint:fix
  npm run format
  ```

- `npm run format` formatiert JavaScript, CSS, JSON und Shell-Skripte. Für den Shell-Schritt muss `shfmt` verfügbar sein; fehlt es, den nicht ausgeführten Schritt melden.
- `npm test`: alle Tests unter `tests/*.test.js` ausführen.
- Für geänderte JavaScript-Dateien gezielt ESLint und Prettier prüfen, beispielsweise:

  ```sh
  npx --no-install eslint src/services/transport-service.js
  npx --no-install prettier --check src/services/transport-service.js
  ```

- `git diff --check` ausführen und den abschließenden Diff auf unbeabsichtigte Änderungen prüfen.
- Bei Dependency-Änderungen zusätzlich `npm audit --omit=dev` ausführen.
- Tests möglichst mit simulierten API-Antworten schreiben; keine echten Zugangsdaten oder Netzwerkverfügbarkeit voraussetzen.
- Im Abschluss nennen, was geändert und geprüft wurde. Fehlgeschlagene oder nicht ausgeführte Prüfungen offen angeben; simulierte Tests nicht als Live-API-Test darstellen.
