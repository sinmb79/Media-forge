# MediaForge Desktop

Electron shell for launching the local MediaForge runtime as a desktop app.

Current scope:

- start the existing `engine dashboard` runtime in the background
- wait for the local dashboard URL
- open it inside a native Electron window
- prepare the project structure for setup wizard, model management, and NSIS packaging

This directory is intentionally isolated from the root CLI package so the core engine can keep shipping independently while the desktop shell matures.
