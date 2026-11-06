# Bund Wall Calculator

Offline mobile app that calculates bund wall length, width and height for tank farms per **SANS 10089-1**.
It uses the same formulas as the *Calculator_manual_entry.xlsx* spreadsheet, and its built-in self-test checks the app against the spreadsheet's own figures.

**Web app (Android + iPhone):** https://m9r1u5.github.io/Bund-Wall-Calculator/
**Android APK:** [Releases → BundWallCalculator.apk](https://github.com/m9r1u5/Bund-Wall-Calculator/releases/latest)

## Features
- Tank rows (front/back, add more), diameter + height per tank, optional nominal volume override
- **Design** mode – minimum bund L × W and required height (rounded up to 0.1 m)
- **Check existing** mode – enter actual L × W × H and check compliance
- Compliance table: spacing, effective volume vs largest tank, L/W/H
- "Show working" table (every symbol, formula and value)
- To-scale **3D tank-farm mimic** (drag to rotate), plan view with spacing dimensions and side elevation, all redrawn on every change
- PDF report (share from phone), save/open projects, JSON export/import
- Settings: containment % (e.g. 110 %), displacement method, wall thickness for drawings
- Works fully offline; Install and Check-for-update buttons

## Formulas
```
V = π(D/2)²·H          A = π(D/2)²
L_min = D_len·n_row + (n_row−1)·S_tank + 2·S_bund
W_min = ΣD_max(rows) + (rows−1)·S_tank + 2·S_bund
H_calc = V_largest / (L·W − ΣA_tanks)        H_rec = CEILING(H_calc, 0.1)
V_eff = L·W·H − ΣA_tanks·H  ≥  V_largest
```

## Releasing a new version
1. Change the version in **three places**: `version.json`, `APP_VERSION` in `app.js`, `CACHE` in `sw.js`.
2. Commit to `main`. GitHub Pages updates the web app, and the **Build APK** action publishes a new release with the APK.
3. In the app, tap **More → Check for update**.

Verify against current SANS 10089-1 before final design.
