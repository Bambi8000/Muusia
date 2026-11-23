# Avatar 3D — body, posing, cutting and plotting

Avatar 3D uses the MakeHuman HM08 authored human mesh, CC0 shape targets and authored skinning rig. Male and female presets share 25 proportion controls, independent joint controls, deterministic anatomy seeds, orthographic rotation and real 3D visibility cuts.

## Drawing styles

- **Brush** selects a small set of long, open silhouette and anatomical gestures. Brush width mm governs clearance, simplification and minimum stroke length. Line economy removes more marks as it approaches 1. Fingers, toes and facial loops are simplified for broad tools. All output remains centerline paths; the actual brush supplies the ink width.
- **Contours** draws curved intersections across the visible skin. Contour tilt rotates their direction. Lines are attached to the body's coordinate frame, so a cut reveals the existing pattern.
- **Hatching** follows the surface with selective light-based strokes and optional crosshatching. Light direction changes the white highlights; Hatch angle turns the line family. Crosshatching concentrates in the shadows.
- **Contours + hatching** combines the two fine-pen treatments.
- **Inspection** preserves the earlier Silhouette and Mesh edges views.

Pen width defaults to **0.35 mm**. Effective line pitch is at least twice the chosen pen width; 0.9 mm is the default starting pitch. Spacing is measured after the final paper fit and selected-region enlargement. Foreshortened curves can approach each other, so the plotting engine also filters near paths. Cut caps remain unhatched; Cut edges draws their rims.

**Drawing seed** varies stroke phase and omissions independently of the **Anatomy seed**. Drawing style, spacing, pens, light and camera never regenerate the body. Separate pens exposes Outline, Contour and Hatch pens; otherwise Main pen supplies every path.

The normal preview and SVG export honor the paths' intended line-width metadata. G-code follows the same centerlines. For pressure modulation on a machine with a real Z axis, Brush Z can be added last using the existing machine-specific setup. Brush width alone does not add pressure moves.

## Muusia node and animation

Find **Avatar 3D** under Generators → Creatures, or search Avatar 3D in the Catalog / quick-add. The complete feature set is a built-in node. For a ready-made graph, open Help and load **Avatar 3D · Run cycle** or **Avatar 3D · Stand, walk, run**, then select the node to preview its drawing. Its three ports remain **Drawing**, **Silhouette** and **Full body mesh** in that order. The Silhouette reference shares the styled drawing's position and scale. Both path ports follow the camera and cut controls. The full mesh carries the complete posed body in the original anatomy coordinate frame; connect it to Mesh Slice for flat cross sections. Camera, visibility cuts and drawing style affect the path outputs without cropping the mesh port.

Body area reveals local anatomy controls without resetting other areas. All numeric controls retain value inputs. Motion Manual exposes repeatable Phase; Timeline uses the existing ANIMATE clock. Turntable, Rotating bust and Feet slice work with every drawing style. Whole-body framing fixes scale while cutting or turning; Selected region enlarges the retained region. Drawing size mm is the longest framed extent, limited by paper and Margin.

**Start pose A** and **End pose B** each offer seven presets: **Rest**, **Relaxed**, **Contrapposto**, **Reach**, **Hands on hips**, **Seated** and **Mid-step**. Rest with zero offsets and Ground feet off reproduces the previous mesh exactly. **Adjust pose** selects an endpoint; **Pose body part** reveals its torso, head, left/right arm or left/right leg controls. Each endpoint retains 28 independent angle offsets. Arms include shoulder direction and twist, elbow and wrist; legs include hip direction and twist, knee and ankle. Presets provide a starting point, and final joint angles stay within their control limits. Fingers move with their hands.

**Pose motion → Manual** exposes **Pose blend A → B**. **Timeline** follows ANIMATE with **One-way** or **Ping-pong** playback. **Pose easing → Smooth** eases the transition; **Linear** keeps uniform rotation progress. The joints interpolate along their shortest quaternion rotations, and seeking to a frame produces the same pose regardless of playback order. The transition uses a fixed framing envelope, including for Selected region, so a reach does not resize the figure as the arm rises. Pose motion and the existing camera/cut motion remain independent and can run together.

**Ground feet** moves the complete posed figure so its lowest skin point touches the floor. It does not plant individual feet or prevent collisions. Automatic Bust and Feet cuts follow the posed body landmarks; Manual cut height remains measured in the original soles-to-crown reference. Body adjustments, anatomy seeds, drawing seeds and all plotting styles remain available with every pose.

## Walk cycle

Choose **Posing → Walk cycle** for a periodic walk in place. **Stride length ×** changes the hip excursion, knee flexion and ankle motion; **Arm swing ×** controls opposing arm swing independently. Both range from 0 to 1.5. **Walk speed ×** selects 1–6 complete cycles in each timeline loop. Whole multiples ensure a continuous wrap; the existing ANIMATE playback rate and frame count determine the displayed cadence. Use at least 24 frames per cycle for a smooth frame sequence, especially at higher speeds.

**Walk motion → Timeline** follows ANIMATE. **Manual** exposes **Walk phase** for exact poses; phases 0 and 1 are the same point in the gait. Timeline sampling excludes the duplicated end pose. The walk includes alternating knee flexion, foot roll, pelvic movement and torso counter-turn. **Ground walking feet** applies the existing floor grounding. This is a procedural art gait without a planted-foot solver.

**Pose body part** applies the saved Start A angle offsets to the walking joints. The pose presets and End B offsets remain saved for Pose transition mode. Body adjustments and anatomy seeds regenerate the same shaped body before it walks; drawing seeds, plotting treatments, camera and cuts keep their existing roles. All frames share one full-cycle framing envelope, including enlarged anatomical Bust and Feet views, so the figure keeps its scale during playback. The full mesh port carries the complete walking body.

## Standing, walking and running

Choose **Posing → Stand / walk / run** for a shared movement cycle. **Start movement** and **End movement** can each be Standing, Walking or Running. **Movement transition → Manual** exposes **Movement blend A → B**. Standing to Running passes exactly through Walking at 50%; adjacent movement types blend smoothly between their joint controls. Standing holds a relaxed pose independently of cycle phase. Running adds forward lean, bent elbows, stronger knee recovery and a brief flight phase.

**Cycle motion → Timeline** advances the shared step phase without resetting it when the movement blend changes. **Manual** exposes **Cycle phase**. **Cycle speed ×** uses whole cycles per timeline loop, with independent **Stride length ×**, **Arm swing ×** and Start A joint offsets. **Ground movement** includes the running flight lift above the floor. Body adjustments and both seeds retain their existing roles; every plotting treatment, camera view and cut works on the current complete moving body.

Set **Movement transition → Timeline** for a smooth **One-way** start/stop or **Ping-pong** transition. This blend clock is separate from the cycle phase. Ping-pong from Standing through Walking to Running and back gives a repeatable whole sequence. One-way is a finite transition whose final state may differ from its start. One shared framing envelope covers the cycle and all intermediate movement blends, including anatomical Bust and Feet framing. The gait remains a procedural art animation without foot-plant or collision solving.

The Help examples **Avatar 3D · Run cycle** and **Avatar 3D · Stand, walk, run** load 24 and 72 paused frames respectively. Increase the animation frame count when using higher cycle speeds.

## Review and SVG samples

Build the anatomy review with `node tools/build-avatar-review.mjs <absolute-output.html>` or the four-style comparison with `node tools/build-avatar-review.mjs <absolute-output.html> --plot`. Both are self-contained and use the actual node geometry. The style comparison allows body edits, seed changes, rotation and cuts; its SVG buttons export the displayed physical dimensions and tool width.

Run `node tools/export-avatar-studies.mjs` to write full-body studies for both bodies in all four styles, plus bust and feet studies. The ZIP includes physical-size SVGs, seeds, path statistics and a manifest. Print or import at 100% for a small ink/spacing test before a long plot.

Build the pose explorer with `node tools/build-avatar-review.mjs <absolute-output.html> --poses`. It pairs the moving shaded body with the selected plotting style, separate endpoint offsets, body adjustments, seeds, rotation and slicing. Play once previews one transition, with a fresh drawing when paused or finished. The Help examples **Avatar 3D · Pose transition** and **Avatar 3D · Seated pen study** are ready-to-edit node patches.

Use `--walk` instead to open the same explorer in Walk cycle mode. **Play walk** repeats until paused; the draft shaded body moves during playback and the selected plotting style redraws when paused. The Help example **Avatar 3D · Walk cycle** loads a ready-to-edit walking node with 24 paused animation frames. Run `node tools/export-avatar-walk.mjs` for 24 Brush frames of each body plus four-style and slicing studies, packaged with physical-size SVGs and a settings manifest under `output/avatar-walk-studies`.

Use `--run` for the Standing/Walking/Running explorer. **Playback → Cycle** loops the held movement blend; **Transition** plays one continuous A-to-B change and draws the final frame. Both previews use the actual moving skin and keep the step phase coherent. Run `node tools/export-avatar-locomotion.mjs` for running loops, finite Standing-to-Walking-to-Running frame sequences, plotting styles and anatomical cuts for both bodies under `output/avatar-run-studies`.

Run `node tools/export-avatar-poses.mjs` to write `output/avatar-pose-studies`: all seven Female presets as Brush and 0.35 mm Contours SVGs, plus a grounded 12-frame Brush transition from Relaxed to Reach. Its frames share the same camera and transition framing. The directory and ZIP contain the SVGs, README and manifest with seeds, pose settings, frame bounds and path statistics. An optional output-directory argument changes the destination.

## Geometry and source assets

`src/avatar-geometry.js` applies authored MakeHuman targets and local proportion changes. Draft uses 26,756 source skin triangles; Review uses one Loop subdivision (107,024 triangles). Axes are X across, negative Y front, Z up; rest body height is normalized to one. Posing preserves this rest basis and bone lengths rather than renormalizing each frame. `src/avatar-pose.js` resolves the rig against the morphed body, deforms the skin with authored weights, then refines the posed surface for Review quality. `src/avatar-pose-control.js` shares endpoint controls, deterministic playback and transition framing between the node and review.

Source URLs, hashes and the CC0 licence are retained in `src/assets/avatar-makehuman-data.js` and `src/assets/avatar-makehuman.LICENSE.txt`. No MakeHuman/MPFB application code is included. `tools/import-makehuman-avatar.mjs` reproduces the packed data from verified source assets. These are authored models; `tools/export-avatar-ply.mjs` samples their surfaces as deterministic, area-weighted point clouds with unit normals.

The CC0 game-engine rig and skin weights are retained in `src/assets/avatar-makehuman-rig.js` and its licence sidecar; `tools/import-makehuman-avatar-rig.mjs` reproduces them. Finger influences follow their hand and toe influences follow their foot. The pose presets are starting art poses; manual joint editing does not include collision avoidance or inverse kinematics.

`src/avatar-render.js` clips triangles, reconstructs and caps sections, projects meshes and supplies the visible depth/normal field. Cuts retain the source body's coordinates. `src/avatar-plot.js` joins visible strokes, generates body-anchored surface lines and applies physical pitch/clearance rules. Dense drawings coarsen within a bounded point budget. `src/avatar-plot-export.js` writes physical-size vector SVG samples.

## Checks

Run `node tools/validate-avatar.mjs` for mesh, camera, cuts and animation checks; `node tools/validate-avatar-plot.mjs` for physical plotting paths, visibility, styles and seed stability; `node tools/validate-avatar-pose.mjs` for joint independence and pose transitions; `node tools/validate-avatar-walk.mjs` for walk loops; and `node tools/validate-avatar-locomotion.mjs` for Standing/Walking/Running blends, flight, cyclic continuity, framing and compatibility. The anatomy, pose, walk and run explorers and style comparison use the actual geometry and drawing engines.
