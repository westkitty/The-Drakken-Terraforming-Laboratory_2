# v1.8 — Interactive Celestial Scene

v1.8 keeps the dependable v1.7 Canvas globe and adds a separate interaction/presentation overlay so the simulation cannot disappear if optional graphics features fail.

- The distant scene now contains an interactive primary, four non-canon reference orbitals, a satellite moon, an orbital relay, and an asteroid belt layered over the existing deep parallax star field.
- Hover acquires celestial targets; click opens a compact dossier; double-click or **Focus Lock** holds a target and draws a persistent tracking link.
- `LAB-STAR` is bound to authoritative simulated stellar state. Bond depletion changes its state readout, and heliocide overlays a black-hole/accretion/lensing presentation over the distant primary.
- A separate globe lighting layer adds a directional day/night terminator, star-facing atmosphere rim, bond-aware Starsilk filaments, and a much darker collapsed-star state without replacing solver-backed surface rendering.
- All other orbital names/distances are explicitly laboratory visual references, not canon declarations.

Validation: full deterministic suite, Python compilation, JavaScript syntax, static HTTP delivery, wheel asset inspection. Pixel-level Chromium proof is not claimed in the execution container because its graphics process cannot initialize.
