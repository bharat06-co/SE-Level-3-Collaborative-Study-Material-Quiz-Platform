# NFR-006 browser compatibility evidence

TC-PORT-01 runs the real React/Vite client against the real Express routes,
JWT authentication and disposable MongoDB data. It checks the application
health screen, student material sign-in/list/detail flow, contributor quiz
sign-in/editor flow and uncaught page errors.

## Automated run

Run on 30 October 2026 from the NFR-006 branch:

| Browser | Version | Result |
| --- | --- | --- |
| Google Chrome | 156.0.8078.76 | PASS |
| Firefox | 157.0 | PASS |
| WebKit | 27.2 | PASS |
| Microsoft Edge | 156.0.4314.50 | PASS using the official vendor package; repeated by CI with branded Edge |

The pull request workflow installs branded Chrome and Edge plus Playwright
Firefox and WebKit, requires all four runs to pass, and uploads `results.json`
and one screenshot per browser as a retained artifact.

## Real Safari manual run

Safari 26.6.2 on macOS passed the same visible smoke path on 30 October 2026:

1. The home screen reported that the API and MongoDB were connected.
2. A disposable student signed in, opened the material list and opened a
   material detail page with rating, comments and report controls.
3. A disposable contributor signed in to quiz authoring and the draft editor
   rendered with title, topic, retake and question controls.

The run used only disposable local identities and data. No production account
or production database was accessed.

## Limitations

This environment provides one installed release for each branded browser and
one Playwright build for Firefox/WebKit. It cannot retain the previous stable
release of Edge or real Safari side by side. The current branded releases,
current Firefox/WebKit engines and real Safari are covered; previous-version
coverage must be repeated on a browser farm or a device that retains those
versions before claiming the full “latest two versions” matrix.
