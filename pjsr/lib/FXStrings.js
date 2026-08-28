// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Strings_js
#define __FX_Strings_js

/*
 * FXStrings.js - the interface, in English and French.
 *
 * Every string the user can read lives here and nowhere else. A literal left in
 * FXDialog.js is a string that silently stays English when the language is
 * switched, and nothing on screen would say so - which is why tests/strings
 * asserts that the two tables carry exactly the same keys and that neither
 * carries an empty one.
 *
 * Keys follow the control they belong to: a slider named "gainSii" reads its
 * label from "gainSii" and its tooltip from "gainSiiTip". Sliders are built by
 * fxNumericRow, which already takes that name, so the pairing is mechanical
 * rather than remembered.
 *
 * Rich text is allowed - PixInsight renders a subset of HTML in tooltips - but
 * the markup must be identical in both languages, or one of them silently loses
 * its formatting. The test checks that too.
 *
 * On translating this file: the terms of art are the ones French-speaking
 * astrophotographers actually use in PixInsight, not literal translations.
 * "starless" stays "starless", because that is what the tools are called;
 * "black point" is "point noir"; "midtones" is "tons moyens"; "stretch" stays
 * "stretch", because "etirement" is not what anybody says at the eyepiece.
 */

var FX_UI =
{
   en:
   {
      // --- the header ------------------------------------------------------
      tagline:        "Your channels already hold the colour. This decides where it goes.",
      byLine:         "by CaeloWorks",
      byLineTip:      "https://pixinsight-scripts.caelo.works/",
      language:       "Language:",
      languageTip:    "<p>The language of this dialog. Remembered between sessions.</p>"
                    + "<p>Image identifiers and console output are not translated: they are "
                    + "what you type and what you paste into a forum post.</p>",

      // --- the banner ------------------------------------------------------
      bannerLinear:   "<b>SUPPLY NON-LINEAR (STRETCHED) IMAGES.</b> Linear data is not supported: "
                    + "stretch each channel before you run this.",

      // --- channels --------------------------------------------------------
      threeChannels:  "3 channels (Sii / Ha / Oiii)",
      twoChannels:    "2 channels (Ha / Oiii)",
      starlessOnly:   "Starless only - do not build a stars image",
      palette:        "Palette:",
      reloadList:     "Reload image list",


      // --- linear input -----------------------------------------------------
      secLinear:      "Linear input (auto stretch)",
      linearBarTip:   "<p>Stretch the channels for you before anything else runs.</p>"
                    + "<p><b>Experimental.</b> This was withdrawn in 3.0.0 after four attempts to "
                    + "make it reliable, and is back because the faults behind those attempts are "
                    + "fixed. It has been validated on reference frames whose sky background sits "
                    + "between 2e-3 and 5e-3; deeper data, with the pedestal already subtracted, "
                    + "is not yet tested. Look at the preview before you trust it.</p>",
      linearNote:     "<p>Each channel gets a black point from its own median and MAD, then a "
                    + "midtones curve that puts its background on the target below. Star frames "
                    + "share the nebula's curve and keep their own black point - solving them "
                    + "separately lifts their empty background into a grey floor the screen "
                    + "combination then cannot go below.</p>",
      bannerAuto:     "<b>AUTO STRETCH IS ON.</b> The channels are stretched for you, and the "
                    + "result is a screen transfer, not a considered final stretch - judge it in "
                    + "the preview.",
      noteAlreadyStretched: "the auto stretch is on but these channels already look stretched",
      noteStretchFallback: "GHS DID NOT RUN - the statistical stretch was used instead; see the console",
      linearMethodStf:  "Screen transfer (STF)",
      linearMethodStat: "Statistical stretch",
      linearMethodGhs:  "GeneralizedHyperbolicStretch",
      ghsD:           "Stretch factor (D):",
      ghsDTip:        "<p>How hard the curve lifts. 0 leaves the channel alone; 1 is a moderate "
                    + "stretch and a sensible place to start.</p>"
                    + "<p>GHS concentrates its contrast around the symmetry point below, so this "
                    + "raises the faint signal without flattening the bright cores the way a plain "
                    + "midtones curve does at the same strength.</p>",
      ghsB:           "Local intensity (b):",
      ghsBTip:        "<p>Shapes the contrast around the symmetry point. 0 is the neutral, "
                    + "hyperbolic form.</p>"
                    + "<p>Negative values spread the stretch over a wider range of brightness, "
                    + "positive ones concentrate it more tightly around the symmetry point. Leave "
                    + "it at 0 until the stretch factor is where you want it.</p>",
      ghsAutoSP:      "Place the symmetry point automatically",
      ghsAutoSPTip:   "<p>Put the symmetry point on each channel's own median, which is where its "
                    + "sky background sits and is the level the stretch should pivot around.</p>"
                    + "<p>Untick to place it by hand. Automatic is per channel, so Sii, Ha and "
                    + "Oiii each pivot around their own background rather than a shared guess.</p>",
      ghsSP:          "Symmetry point (SP):",
      ghsSPTip:       "<p>The brightness the stretch pivots around. Everything below it is "
                    + "compressed, everything above expanded.</p>"
                    + "<p>It belongs on the sky background. Placing it too high crushes the faint "
                    + "signal; too low and the background is lifted into the midtones. Only "
                    + "editable with the automatic placement off.</p>",
      linearMethod:   "Method:",
      linearMethodTip: "<p><b>Screen transfer</b> places the black point at the shadows clip below "
                    + "the median, exactly as PixInsight's own auto stretch does.</p>"
                    + "<p><b>Statistical stretch</b> is the same, except that the black point is "
                    + "never placed above the darkest pixel in the frame, so nothing is discarded. "
                    + "It also rescues a channel whose own nebulosity inflates its MAD, which on "
                    + "real Ha data is common enough to be the default.</p>",
      linearTarget:   "Stretch amount:",
      linearTargetTip: "<p>Where the sky background lands after the stretch. 0.25 is the usual "
                    + "screen-transfer target and a good place to judge from.</p>"
                    + "<p>Higher lifts the faint signal and flattens the highlights; lower keeps "
                    + "the contrast and hides the faintest structure. This is a starting point to "
                    + "work from, not a finished stretch.</p>",
      linearClip:     "Shadows clip:",
      linearClipTip:  "<p>How far below the median the black point sits, in MAD sigmas.</p>"
                    + "<p>2.80 is the screen-transfer convention and clips almost nothing - "
                    + "measured on the reference frames, 0.002% of Sii and 0.036% of Oiii. Lower "
                    + "it if a channel comes out sitting on a pedestal; at 1.00 it would discard "
                    + "10 to 13% of those same frames.</p>",
      linearNoClip:   "Never clip the black point",
      linearNoClipTip: "<p>Hold the black point at the darkest pixel in the frame, whatever the "
                    + "shadows clip asks for. Nothing is discarded at all.</p>"
                    + "<p>Already implied by the statistical stretch method; this forces it for "
                    + "the screen transfer one too.</p>",

      // --- sections --------------------------------------------------------
      secGeneral:     "General",
      secNormalize:   "Channel normalization",
      secWeighting:   "Weighting, transition and colour",
      secStars:       "Stars",
      secScnr:        "Green / magenta suppression",
      secHdr:         "HDR and local contrast",
      secLuminance:   "Artificial luminance",
      secOutput:      "Output",

      // --- preview ---------------------------------------------------------
      preview:        "Preview",
      targetStarless: "Starless",
      targetStars:    "Stars",
      targetLum:      "Luminance",
      fit:            "Fit",
      oneToOne:       "1:1",
      detailAuto:     "Detail: auto",
      detail11:       "Detail: 1:1",
      detail12:       "Detail: 1:2",
      detail14:       "Detail: 1:4",
      detail18:       "Detail: 1:8",
      auto:           "Auto",
      refresh:        "Refresh",
      selectChannels: "Select your channels to build a preview.",
      rendering:      "Rendering preview...",
      renderingShort: "rendering preview...",
      renderFailed:   "The render failed - see the console.",
      noHistogram:    "No histogram yet - render a preview first.",

      // --- levels ----------------------------------------------------------
      reset:          "Reset",
      resetAll:       "Reset all",
      imageName:      "Image name:",
      execute:        "Execute",
      close:          "Close",

      // --- notices, section notes, palette names ----------------------------
      noteLevelsElsewhere: "levels also in force on:",
      noteLinear:     "THESE CHANNELS LOOK LINEAR. Stretch them first; this script needs "
                      + "non-linear images.",
      noteMultiscale: "multiscale stages are approximate at this sampling",
      notePeaks:      "star peaks are averaged at this sampling, so previewed stars are dimmer "
                      + "than the final ones; use Detail 1:1 to judge them",
      renderedAt:     "%d x %d rendered at 1:%d, shown at %d%%",
      setStarless:    "starless",
      setStars:       "stars",
      setLum:         "luminance",
      levelsStarless: "Levels - starless image",
      levelsStars:    "Levels - stars image",
      levelsLum:      "Levels - luminance layer",
      levelsReadout:  "black %.4f mid %.4f white %.4f",
      zoomNote:       "<p>How large the rendered preview is drawn. This is a display scale only "
                      + "- it repaints the image already in hand and never runs the pipeline "
                      + "again.</p><p><b>Roll the mouse wheel over the panel</b> to zoom "
                      + "continuously about the cursor: the pixel under the pointer stays under "
                      + "the pointer. Drag to pan, and double click anywhere in the panel to go "
                      + "back to Fit.</p><p>How much detail there is to zoom into is set by "
                      + "<b>Detail</b>, next to this.</p>",
      baseIdNote:     "<p>Base identifier of the images produced. The stars image gets a _stars "
                      + "suffix, the screen combination _combined, the luminance _L.</p><p>It "
                      + "follows the palette you choose, so a Warhol run lands in Warhol and an "
                      + "HSO run in HSO. Type your own if you prefer; it will be replaced the "
                      + "next time you change palette.</p><p>Existing identifiers are never "
                      + "overwritten: a numeric suffix is added to the whole group at once, so "
                      + "the set always matches.</p>",
      lumNote:        "<p>The CIE L*a*b* lightness of the colour result, extracted as its own "
                      + "greyscale layer named <i>name</i>_L. Because it is a standard lightness "
                      + "it behaves in an LRGB combination, in a mask or in a curve exactly as "
                      + "any other luminance does.</p><p>To stretch it, set the preview "
                      + "<b>Target</b> to <b>Luminance</b> and use the histogram below the "
                      + "preview - it belongs to whichever image is on screen, and the layer "
                      + "keeps its own three markers.</p>",
      scnrNote:       "<p>The stock <b>SCNR</b> process, average neutral, applied to the nebula "
                      + "only. Green is removed directly; magenta is green in the inverse.</p>",
      starsNote:      "<p>The star field is a fixed broadband-style "
                      + "combination:<br/>&nbsp;&nbsp;R = 0.5&middot;Ha + "
                      + "0.5&middot;Sii&nbsp;&nbsp;&nbsp;G = 0.3&middot;Ha + "
                      + "0.7&middot;Oiii&nbsp;&nbsp;&nbsp;B = Oiii</p><p>Stars are broadband "
                      + "sources, not line emitters, so mixing them this way gives more "
                      + "believable colour than running the nebula's palette over them.</p>",
      styleNote:      "<p>One list for the palette and its starting point: choosing an entry "
                      + "sets the channel mapping, every tuning slider and the output image name "
                      + "at once. You are free to move any slider afterwards.</p><p>The "
                      + "<b>Foraxx</b> entries blend red and green between two sources with "
                      + "dynamic masks, so the palette changes across the frame. The rest are "
                      + "fixed mappings: the three letters give the source of R, G and B in "
                      + "order, so <b>HSO</b> means red from Ha, green from Sii, blue from "
                      + "Oiii.</p><p><b>Andy Warhol</b> pushes saturation hard and posterises the "
                      + "result into flat blocks of colour, like a screen print.</p><p>Entries "
                      + "that need Sii are hidden while you are in 2 channel mode.</p>",
      noticeLevelsReset: "Source image changed - levels reset (%s).",
      noticeCreated:  "Created %s. Change palette and run again, or Close.",
      normalizeBarTip: "<p>Brings the channels to a common brightness before they are combined, "
                      + "following the published narrowband channel normalization "
                      + "method.</p><p>Each channel gets a black point interpolated between its "
                      + "minimum and its median, then a midtones curve that moves its median onto "
                      + "the reference channel's - a curve stretch, not a linear scale, so faint "
                      + "structure is lifted without the bright cores running away.</p><p>This is "
                      + "the real fix for an SHO that comes out overwhelmingly green: Ha is "
                      + "typically several times stronger than Sii and Oiii, and no amount of "
                      + "per-pixel colour correction afterwards can undo that. Fix the balance "
                      + "first and the palette behaves.</p>",
      scnrBarTip:     "<p>Enable or skip the whole colour suppression stage.</p><p>It applies "
                      + "to the <b>nebula only</b>. The stars have their own green removal in the "
                      + "Stars section, because this correction is tuned for green that comes "
                      + "from the channel imbalance and would flatten real broadband star colour "
                      + "into grey.</p>",
      hdrBarTip:      "<p>Enable or skip highlight compression, HDRMultiscaleTransform and "
                      + "local contrast as a group. Off by default, with every amount at "
                      + "zero.</p>",
      lumBarTip:      "<p>Produce a synthetic luminance layer from the narrowband channels, "
                      + "named <i>name</i>_L.</p>",
      normalizeRef:   "Reference:",
      normalizeRefTip: "<p>The channel every other one is brought up to. Ha is almost always the "
                      + "strongest, so it is the usual reference.</p>",
      styleForaxxClassic: "Foraxx - classic (starless identical to the original)",
      styleForaxxClean: "Foraxx - with colour clean-up (recommended)",
      styleForaxxSoft: "Foraxx - soft transition",
      styleForaxxGold: "Foraxx - gold forward",
      styleForaxxTeal: "Foraxx - teal forward",
      styleForaxxHOO: "Foraxx HOO - dynamic, Ha and Oiii only",
      styleWarhol:    "Andy Warhol - poster colour",
      styleSHO:       "SHO (Hubble)",
      styleHSO:       "HSO",
      styleHOS:       "HOS",
      styleOHS:       "OHS",
      styleOSH:       "OSH",
      styleSOH:       "SOH",
      styleHOO:       "HOO (bicolour)",
      styleOHH:       "OHH",

      // --- plain control tooltips -------------------------------------------
      threeChannelRadioTip: "<p>You collected Sii, Ha and Oiii. Every palette is available.</p>",
      twoChannelRadioTip: "<p>Dual narrowband OSC data, or mono Ha and Oiii only. The Sii rows are "
                      + "disabled, and the palette list is limited to the mappings that do not "
                      + "need Sii.</p><p>If a Sii palette is selected when you choose this, it "
                      + "moves to Foraxx HOO - the first entry that works without Sii, not a "
                      + "matching two-channel mapping. Pick the one you want afterwards.</p>",
      reloadTip:      "<p>Rescan the workspace. Use this if you created or renamed images after "
                      + "opening this dialog.</p>",
      previewTargetTip: "<p>Which image to show, and which image the histogram below belongs to. "
                      + "Each of the three carries its own black point, midtones and white point; "
                      + "switching here brings that image's markers back, and each set is applied "
                      + "only to its own image when you press Execute.</p><p><b>Luminance</b> is "
                      + "the extracted L layer. You can look at it without switching the "
                      + "Artificial luminance section on - it is only written out when that "
                      + "section is on.</p>",
      previewDetailTip: "<p>The sampling the pipeline actually runs at. Changing this <i>does</i> "
                      + "re-render.</p><p><b>Auto</b> renders at twice the panel resolution, so "
                      + "zooming to 200% is still pixel exact. Choose 1:1 when you want to "
                      + "inspect the real result - it is slow on a large frame and uses a lot of "
                      + "memory.</p>",
      refreshTip:     "<p>Re-render the preview now, re-reading and re-measuring the source "
                      + "images.</p><p>Use this after editing a channel in PixInsight: the "
                      + "preview works from its own downsampled copies, and nothing else drops "
                      + "them while the image keeps its identifier.</p>",
      levelsTip:      "<p>Histogram of the image the preview is showing, as it stands "
                      + "immediately before its own levels transform, drawn as one outline per "
                      + "channel on a logarithmic vertical scale.</p><p>Drag the three triangles: "
                      + "the dark one on the left is the black point, the grey one in the middle "
                      + "is the midtones balance, the light one on the right is the white point. "
                      + "Double click a triangle to reset just that one.</p><p><b>Each image "
                      + "keeps its own three markers.</b> Change the preview target and this "
                      + "panel switches to that image's set; at Execute each set is applied to "
                      + "its own image and to nothing else.</p>",
      levelsReadoutTip: "<p>Black point, midtones balance and white point of the image the "
                      + "preview is showing.</p>",
      levelsAutoTip:  "<p>Read a starting point off the current histogram: clip the black point "
                      + "just below where real signal begins, and place the median at a "
                      + "comfortable 0.30.</p><p>Applies to the image the preview is showing.</p>",
      levelsResetTip: "<p>Put this image's three markers back to black 0, mid 0.5, white 1 - an "
                      + "identity transform. The other images keep theirs.</p>",
      newInstanceTip: "<p>New Instance - drag this onto the workspace to save the current "
                      + "settings as a process icon.</p>",
      resetAllTip:    "<p>Put every slider and checkbox back to its factory default. Your "
                      + "channel selection is kept.</p>",
      executeTip:     "<p>Build the full resolution images with the current settings.</p><p>The "
                      + "dialog stays open, so you can change palette and run it again. Each run "
                      + "gets its own set of image names.</p>",
      cancelTip:      "<p>Close the dialog. Anything you already built with Execute stays where "
                      + "it is.</p>",

      // --- checkboxes -------------------------------------------------------
      starlessOnlyTip: "<p>Tick this if your images still contain stars, or if you do not want a "
                      + "separate colour stars image. The star columns and the whole Stars "
                      + "section are disabled.</p>",
      starCleanGreen: "Remove green from the stars",
      starCleanGreenTip: "<p>A two-pass green removal: remove green, push hard into the highlights "
                      + "with a midtones transfer, remove green again on the stretched data, then "
                      + "undo the push. Working on the stretched version is what lets the second "
                      + "pass reach the faint fringing the first one misses.</p><p>The <b>Green / "
                      + "magenta suppression</b> section below does not touch the stars at all: "
                      + "that correction is tuned for green coming from the channel imbalance, "
                      + "and over a star field it flattens real broadband star colour into "
                      + "grey.</p>",
      scnrPreserveL:  "Preserve lightness",
      scnrPreserveLTip: "<p>Keeps the pixel's brightness where it was after the cast is removed, "
                      + "which is what stops the result going flat and dim.</p>",
      makeCombined:   "Also create a screen combination of the starless and stars images",
      makeCombinedTip: "<p>Produces <i>name</i>_combined as ~(~starless * ~stars) - the screen "
                      + "blend - after the levels have been applied to each of them. It can only "
                      + "be seen after Execute - the preview no longer has a combined target.</p>",
      makeFactors:    "Keep the 'o' and 'ho' dynamic factor images",
      makeFactorsTip: "<p>The masks the dynamic blend is built from, written out as images for "
                      + "inspection or for reuse as masks elsewhere.</p>"
                      + "<p>A three-channel palette produces two, <i>name</i>_o and "
                      + "<i>name</i>_ho; a two-channel one has no Sii to switch away from, so it "
                      + "produces only _ho. On a fixed mapping they are written but nothing uses "
                      + "them, because the Foraxx amount is held at 0 there.</p>",
      autoPreview:    "Auto",
      autoPreviewTip: "<p>Re-render the preview automatically a moment after a control settles. "
                      + "Turn it off on very large images and use Refresh instead.</p>",

      // --- sliders: label and tooltip, keyed on the row name --------------
      normSii:        "Sii level:",
      normSiiTip:     "<p>Where Sii's median lands, as a multiple of the reference "
                      + "channel's.</p><p>1.00 matches it exactly. Below 1 leaves Sii darker than "
                      + "Ha, above 1 pushes it brighter.</p>",
      normHa:         "Ha level:",
      normHaTip:      "<p>Where Ha's median lands, as a multiple of the reference channel's. With "
                      + "Ha as the reference, 1.00 leaves it exactly as it was.</p>",
      normOiii:       "Oiii level:",
      normOiiiTip:    "<p>Where Oiii's median lands, as a multiple of the reference "
                      + "channel's.</p><p>Oiii is usually the weakest channel, and this is the "
                      + "slider that decides how much teal the palette ends up with.</p>",
      normShadow:     "Shadow point:",
      normShadowTip:  "<p>Where the black point sits, interpolated from each channel's darkest "
                      + "pixel towards its median.</p><p>0 puts it exactly on the minimum and "
                      + "discards nothing. Raising it deepens the background before the levels are "
                      + "matched.</p>",
      gainSii:        "Sii weight:",
      gainSiiTip:     "<p>Weight applied to Sii before the combination.</p><p>This is a soft "
                      + "gain, g&middot;x / (1 + (g-1)&middot;x). It keeps 0 at 0 and 1 at 1, so "
                      + "raising a channel brightens the faint signal without ever clipping the "
                      + "bright cores the way a plain multiplication would.</p>",
      gainHa:         "Ha weight:",
      gainHaTip:      "<p>Weight applied to Ha before the combination. Soft gain, no highlight "
                      + "clipping.</p><p>On a Foraxx palette Ha feeds the ho mask as well as "
                      + "both blended slots, so raising it moves the gold / teal boundary "
                      + "outwards. On a fixed mapping it only brightens wherever that mapping "
                      + "puts Ha.</p>",
      gainOiii:       "Oiii weight:",
      gainOiiiTip:    "<p>Weight applied to Oiii before the combination. Soft gain, no highlight "
                      + "clipping.</p><p>On a Foraxx palette Oiii feeds both dynamic masks as "
                      + "well as the anchor slot, so this slider has the strongest effect on where "
                      + "the palette switches between gold and teal. On a fixed mapping it only "
                      + "brightens wherever that mapping puts Oiii.</p>",
      blend:          "Foraxx amount:",
      blendTip:       "<p>Interpolates between the plain fixed mapping and the full dynamic "
                      + "blend.</p><p>0.00 gives the ordinary mapping, 1.00 the classic Foraxx "
                      + "result.</p><p><b>Foraxx palettes only.</b> A fixed mapping such as SHO or "
                      + "HOO is a straight permutation of the channels, so there is nothing for "
                      + "this to interpolate; it and the two transition sliders grey out.</p>",
      hardO:          "Sii/Ha transition:",
      hardOTip:       "<p>Hardness of the 'o' mask, o = Oiii^(k&middot;~Oiii), which decides "
                      + "where red comes from Sii and where it comes from Ha.</p><p>1.00 is the "
                      + "original. Higher values delay and sharpen the switch; lower values bring "
                      + "it in earlier and soften it.</p><p><b>Three-channel Foraxx only</b> - it "
                      + "needs Sii to transition from, and a fixed mapping has no transition.</p>",
      hardHO:         "Ha/Oiii transition:",
      hardHOTip:      "<p>Hardness of the 'ho' mask, ho = "
                      + "(Ha&middot;Oiii)^(k&middot;~(Ha&middot;Oiii)), which drives the green "
                      + "channel and therefore the gold-to-teal boundary.</p><p>Usually the most "
                      + "consequential slider here.</p><p><b>Foraxx palettes only</b> - a fixed "
                      + "mapping has no transition to shape.</p>",
      curveStrength:  "Signature curves:",
      curveStrengthTip: "<p>Scales the two hue curves of the original script towards or away from "
                      + "the identity transform.</p><p>These act on hue, not brightness: they "
                      + "rotate the reds towards gold and the blues towards teal, and are a large "
                      + "part of what makes a Foraxx image look the way it does.</p>",
      satStrength:    "Selective saturation:",
      satStrengthTip: "<p>Scales the global saturation curve and both selective saturation "
                      + "passes, which boost a narrow band of golds and a narrow band of blues "
                      + "while leaving everything between them alone.</p>",
      extraSaturation: "Overall saturation:",
      extraSaturationTip: "<p>A flat saturation boost across every hue, on top of the selective pass "
                      + "above.</p><p>0 leaves it alone. This is what gives the Andy Warhol palette "
                      + "its poster colour.</p>",
      posterLevels:   "Posterise levels:",
      posterLevelsTip: "<p>Quantises each channel to this many evenly spaced levels, so gradients "
                      + "become flat blocks of colour - the screen-print look.</p><p>0 is off. 4 to "
                      + "8 gives a recognisable poster; higher values are subtler.</p>",
      starStretch:    "Star brightness:",
      starStretchTip: "<p>A hyperbolic stretch, ((3^k)&middot;$T) / ((3^k-1)&middot;$T+1) - the "
                      + "midtones transfer function with m = 1/(1+3^k). It fixes 0 and 1 and is "
                      + "monotonic, so it lifts faint stars hard without ever clipping a bright "
                      + "core. 0 leaves them exactly as the combination produced them.</p><p>1.00 "
                      + "is a gentle lift that suits stars which have already been stretched, which "
                      + "is what this script expects.</p><p>At 5.00 the multiplier is 243: on a "
                      + "star frame whose background already sits at 0.02 that lifts it to 0.83, "
                      + "and at 0.05 to 0.93 - a white sky either way. Raise it only if your stars "
                      + "really are still faint, and watch the preview.</p>",
      starSaturation: "Star colour boost:",
      starSaturationTip: "<p>A hue-weighted saturation boost, applied after the brightness stretch. "
                      + "This is what brings out the blue / white / amber spread of a star "
                      + "field.</p><p>0 leaves the colour alone. 1.00 is a good starting point once "
                      + "the brightness is where you want it.</p>",
      scnrGreen:      "Green amount:",
      scnrGreenTip:   "<p>The amount for the green pass. 0 is off, 1 removes all of the detected "
                      + "excess.</p>",
      scnrMagenta:    "Magenta amount:",
      scnrMagentaTip: "<p>The amount for the magenta pass, run as invert, remove green, "
                      + "invert.</p>",
      hdrAmount:      "Highlight compression:",
      hdrAmountTip:   "<p>Pulls the tones above the knee back towards it. Nothing below the knee "
                      + "is touched at all.</p><p>The correction is computed on luminance and "
                      + "applied as a single scale factor to all three channels, so hue and "
                      + "saturation survive intact. Entirely scale invariant, so the preview "
                      + "matches the final image exactly.</p>",
      hdrKnee:        "Compression knee:",
      hdrKneeTip:     "<p>The brightness above which compression starts. Everything darker is "
                      + "left completely alone.</p><p>Lower it to reach further down into the "
                      + "midtones, raise it to affect only the very brightest cores.</p>",
      hdrLayers:      "HDR multiscale layers:",
      hdrLayersTip:   "<p>Runs a multiscale HDR transform with this many layers. 0 skips "
                      + "it.</p><p>Far more effective than a curve on genuinely blown cores, but it "
                      + "works on spatial scales, so at a reduced preview sampling it can only be "
                      + "indicative. Check the result at 1:1, or after Execute.</p>",
      localContrast:  "Local contrast:",
      localContrastTip: "<p>A large scale unsharp mask on the luminance, to put back structure that "
                      + "highlight compression flattens. Also scale dependent, so the preview is "
                      + "indicative.</p>",
      lumApply:       "Apply to the image:",
      lumApplyTip:    "<p>How much of the artificial luminance to substitute into the colour "
                      + "image.</p><p>0 produces the layer and leaves the colour image untouched, "
                      + "so you can combine them yourself. 1 fully replaces the image's own "
                      + "lightness. The colour ratios are preserved either way, and the "
                      + "substitution stops where a channel would clip.</p>",

      // --- shared fragments -------------------------------------------------
      rangeNote:      "Range %s to %s. The button on the left puts it back to the "
                    + "palette's own starting value.",
      resetToPalette: "Reset to the palette's starting value.",
   },

   fr:
   {
      // --- l'en-tête -------------------------------------------------------
      tagline:        "Vos couches portent d\u00e9j\u00e0 la couleur. Reste \u00e0 d\u00e9cider o\u00f9 elle va.",
      byLine:         "par CaeloWorks",
      byLineTip:      "https://pixinsight-scripts.caelo.works/",
      language:       "Langue :",
      languageTip:    "<p>La langue de ce dialogue. Retenue d'une session \u00e0 l'autre.</p>"
                    + "<p>Les identifiants d'images et la sortie console ne sont pas traduits : "
                    + "c'est ce que vous tapez, et ce que vous collez dans un message de "
                    + "forum.</p>",

      // --- le bandeau ------------------------------------------------------
      bannerLinear:   "<b>FOURNISSEZ DES IMAGES NON LIN\u00c9AIRES (STRETCH\u00c9ES).</b> Les donn\u00e9es "
                    + "lin\u00e9aires ne sont pas prises en charge : stretchez chaque couche avant "
                    + "de lancer ce script.",

      // --- couches ---------------------------------------------------------
      threeChannels:  "3 couches (Sii / Ha / Oiii)",
      twoChannels:    "2 couches (Ha / Oiii)",
      starlessOnly:   "Starless seulement - ne pas construire d'image d'\u00e9toiles",
      palette:        "Palette :",
      reloadList:     "Recharger la liste",


      // --- entree lineaire --------------------------------------------------
      secLinear:      "Entr\u00e9e lin\u00e9aire (auto-stretch)",
      linearBarTip:   "<p>Stretche les couches pour vous avant tout le reste.</p>"
                    + "<p><b>Exp\u00e9rimental.</b> Retir\u00e9 en 3.0.0 apr\u00e8s quatre tentatives pour le "
                    + "rendre fiable, et de retour parce que les fautes \u00e0 l'origine de ces "
                    + "tentatives sont corrig\u00e9es. Valid\u00e9 sur des images de r\u00e9f\u00e9rence dont le "
                    + "fond de ciel se situe entre 2e-3 et 5e-3 ; des donn\u00e9es plus profondes, "
                    + "pi\u00e9destal d\u00e9j\u00e0 soustrait, ne sont pas encore test\u00e9es. Regardez l'aper\u00e7u "
                    + "avant de lui faire confiance.</p>",
      linearNote:     "<p>Chaque couche re\u00e7oit un point noir tir\u00e9 de sa propre m\u00e9diane et de son "
                    + "MAD, puis une courbe de tons moyens qui place son fond sur la cible "
                    + "ci-dessous. Les frames d'\u00e9toiles partagent la courbe de la n\u00e9buleuse et "
                    + "gardent leur propre point noir : les r\u00e9soudre s\u00e9par\u00e9ment rel\u00e8verait leur "
                    + "fond vide en un plancher gris sous lequel la combinaison en mode \u00e9cran ne "
                    + "peut plus descendre.</p>",
      bannerAuto:     "<b>L'AUTO-STRETCH EST ACTIF.</b> Les couches sont stretch\u00e9es pour vous, et "
                    + "le r\u00e9sultat est un transfert d'\u00e9cran, pas un stretch final r\u00e9fl\u00e9chi : "
                    + "jugez-le dans l'aper\u00e7u.",
      noteAlreadyStretched: "l'auto-stretch est actif mais ces couches semblent d\u00e9j\u00e0 stretch\u00e9es",
      noteStretchFallback: "GHS N'A PAS TOURN\u00c9 - le stretch statistique a \u00e9t\u00e9 utilis\u00e9 \u00e0 la place ; voir la console",
      linearMethodStf:  "Transfert d'\u00e9cran (STF)",
      linearMethodStat: "Stretch statistique",
      linearMethodGhs:  "GeneralizedHyperbolicStretch",
      ghsD:           "Facteur de stretch (D) :",
      ghsDTip:        "<p>Avec quelle force la courbe rel\u00e8ve. 0 laisse la couche intacte ; 1 est "
                    + "un stretch mod\u00e9r\u00e9 et un bon point de d\u00e9part.</p>"
                    + "<p>GHS concentre son contraste autour du point de sym\u00e9trie ci-dessous : "
                    + "il rel\u00e8ve donc le signal faible sans aplatir les c\u0153urs brillants comme "
                    + "le ferait une simple courbe de tons moyens \u00e0 force \u00e9gale.</p>",
      ghsB:           "Intensit\u00e9 locale (b) :",
      ghsBTip:        "<p>Fa\u00e7onne le contraste autour du point de sym\u00e9trie. 0 est la forme "
                    + "hyperbolique neutre.</p>"
                    + "<p>Les valeurs n\u00e9gatives \u00e9talent le stretch sur une plage de luminosit\u00e9 "
                    + "plus large, les positives le resserrent autour du point de sym\u00e9trie. "
                    + "Laissez-la \u00e0 0 tant que le facteur de stretch n'est pas r\u00e9gl\u00e9.</p>",
      ghsAutoSP:      "Placer le point de sym\u00e9trie automatiquement",
      ghsAutoSPTip:   "<p>Place le point de sym\u00e9trie sur la m\u00e9diane propre \u00e0 chaque couche, l\u00e0 "
                    + "o\u00f9 se trouve son fond de ciel et le niveau autour duquel le stretch doit "
                    + "pivoter.</p>"
                    + "<p>D\u00e9cochez pour le placer \u00e0 la main. L'automatique est par couche : Sii, "
                    + "Ha et Oiii pivotent chacun autour de leur propre fond plut\u00f4t que d'une "
                    + "estimation commune.</p>",
      ghsSP:          "Point de sym\u00e9trie (SP) :",
      ghsSPTip:       "<p>La luminosit\u00e9 autour de laquelle le stretch pivote. Tout ce qui est en "
                    + "dessous est compress\u00e9, tout ce qui est au-dessus est \u00e9tal\u00e9.</p>"
                    + "<p>Sa place est sur le fond de ciel. Trop haut, il \u00e9crase le signal "
                    + "faible ; trop bas, le fond monte dans les tons moyens. \u00c9ditable seulement "
                    + "si le placement automatique est d\u00e9sactiv\u00e9.</p>",
      linearMethod:   "M\u00e9thode :",
      linearMethodTip: "<p>Le <b>transfert d'\u00e9cran</b> place le point noir \u00e0 l'\u00e9cr\u00eatage des "
                    + "basses lumi\u00e8res sous la m\u00e9diane, exactement comme l'auto-stretch de "
                    + "PixInsight.</p>"
                    + "<p>Le <b>stretch statistique</b> fait de m\u00eame, sauf que le point noir "
                    + "n'est jamais plac\u00e9 au-dessus du pixel le plus sombre de l'image : rien "
                    + "n'est jet\u00e9. Il rattrape aussi une couche dont la n\u00e9bulosit\u00e9 gonfle son "
                    + "propre MAD, ce qui sur du Ha r\u00e9el est assez courant pour en faire la "
                    + "valeur par d\u00e9faut.</p>",
      linearTarget:   "Quantit\u00e9 de stretch :",
      linearTargetTip: "<p>O\u00f9 atterrit le fond de ciel apr\u00e8s le stretch. 0.25 est la cible "
                    + "habituelle d'un transfert d'\u00e9cran, et un bon point d'observation.</p>"
                    + "<p>Plus haut rel\u00e8ve le signal faible et aplatit les hautes lumi\u00e8res ; "
                    + "plus bas conserve le contraste et masque les structures les plus t\u00e9nues. "
                    + "C'est un point de d\u00e9part, pas un stretch abouti.</p>",
      linearClip:     "\u00c9cr\u00eatage des basses lumi\u00e8res :",
      linearClipTip:  "<p>\u00c0 quelle distance sous la m\u00e9diane se place le point noir, en sigmas de "
                    + "MAD.</p>"
                    + "<p>2.80 est la convention du transfert d'\u00e9cran et n'\u00e9cr\u00eate presque rien : "
                    + "mesur\u00e9 sur les images de r\u00e9f\u00e9rence, 0,002 % de Sii et 0,036 % de Oiii. "
                    + "Abaissez-le si une couche ressort pos\u00e9e sur un pi\u00e9destal ; \u00e0 1.00 il "
                    + "jetterait 10 \u00e0 13 % de ces m\u00eames images.</p>",
      linearNoClip:   "Ne jamais \u00e9cr\u00eater le point noir",
      linearNoClipTip: "<p>Maintient le point noir sur le pixel le plus sombre de l'image, quoi que "
                    + "demande l'\u00e9cr\u00eatage des basses lumi\u00e8res. Rien n'est jet\u00e9.</p>"
                    + "<p>D\u00e9j\u00e0 impliqu\u00e9 par la m\u00e9thode du stretch statistique ; ceci le force "
                    + "aussi pour le transfert d'\u00e9cran.</p>",

      // --- sections --------------------------------------------------------
      secGeneral:     "G\u00e9n\u00e9ral",
      secNormalize:   "Normalisation des couches",
      secWeighting:   "Pond\u00e9ration, transition et couleur",
      secStars:       "\u00c9toiles",
      secScnr:        "Suppression du vert et du magenta",
      secHdr:         "HDR et contraste local",
      secLuminance:   "Luminance artificielle",
      secOutput:      "Sortie",

      // --- prévisualisation ------------------------------------------------
      preview:        "Pr\u00e9visualisation",
      targetStarless: "Starless",
      targetStars:    "\u00c9toiles",
      targetLum:      "Luminance",
      fit:            "Ajuster",
      oneToOne:       "1:1",
      detailAuto:     "D\u00e9tail : auto",
      detail11:       "D\u00e9tail : 1:1",
      detail12:       "D\u00e9tail : 1:2",
      detail14:       "D\u00e9tail : 1:4",
      detail18:       "D\u00e9tail : 1:8",
      auto:           "Auto",
      refresh:        "Rafra\u00eechir",
      selectChannels: "Choisissez vos couches pour construire un aper\u00e7u.",
      rendering:      "Calcul de l'aper\u00e7u...",
      renderingShort: "calcul de l'aper\u00e7u...",
      renderFailed:   "Le calcul a \u00e9chou\u00e9 - voir la console.",
      noHistogram:    "Pas encore d'histogramme - calculez un aper\u00e7u d'abord.",

      // --- niveaux ---------------------------------------------------------
      reset:          "R\u00e9initialiser",
      resetAll:       "Tout r\u00e9initialiser",
      imageName:      "Nom de l'image :",
      execute:        "Ex\u00e9cuter",
      close:          "Fermer",

      // --- notices, notes de section, noms de palettes ---------------------
      noteLevelsElsewhere: "niveaux \u00e9galement en vigueur sur :",
      noteLinear:     "CES COUCHES SEMBLENT LIN\u00c9AIRES. Stretchez-les d'abord ; ce script a besoin "
                      + "d'images non lin\u00e9aires.",
      noteMultiscale: "les \u00e9tapes multi-\u00e9chelles sont approximatives \u00e0 cet \u00e9chantillonnage",
      notePeaks:      "les pics des \u00e9toiles sont moyenn\u00e9s \u00e0 cet \u00e9chantillonnage : les \u00e9toiles de "
                      + "l'aper\u00e7u ressortent plus sombres que les finales ; utilisez D\u00e9tail 1:1 "
                      + "pour les juger",
      renderedAt:     "%d x %d calcul\u00e9 en 1:%d, affich\u00e9 \u00e0 %d %%",
      setStarless:    "starless",
      setStars:       "\u00e9toiles",
      setLum:         "luminance",
      levelsStarless: "Niveaux - image starless",
      levelsStars:    "Niveaux - image d'\u00e9toiles",
      levelsLum:      "Niveaux - couche de luminance",
      levelsReadout:  "noir %.4f moyen %.4f blanc %.4f",
      zoomNote:       "<p>La taille \u00e0 laquelle l'aper\u00e7u calcul\u00e9 est dessin\u00e9. Ce n'est qu'une "
                      + "\u00e9chelle d'affichage : elle redessine l'image d\u00e9j\u00e0 en main et ne relance "
                      + "jamais la cha\u00eene de traitement.</p><p><b>Faites tourner la molette "
                      + "au-dessus du panneau</b> pour zoomer en continu autour du pointeur : le "
                      + "pixel sous le pointeur reste sous le pointeur. Faites glisser pour vous "
                      + "d\u00e9placer, et double-cliquez n'importe o\u00f9 dans le panneau pour revenir \u00e0 "
                      + "Ajuster.</p><p>La quantit\u00e9 de d\u00e9tail dans laquelle vous pouvez zoomer "
                      + "est fix\u00e9e par <b>D\u00e9tail</b>, juste \u00e0 c\u00f4t\u00e9.</p>",
      baseIdNote:     "<p>Identifiant de base des images produites. L'image d'\u00e9toiles re\u00e7oit le "
                      + "suffixe _stars, la combinaison en mode \u00e9cran _combined, la luminance "
                      + "_L.</p><p>Il suit la palette que vous choisissez : une ex\u00e9cution Warhol "
                      + "atterrit dans Warhol, une ex\u00e9cution HSO dans HSO. Tapez le v\u00f4tre si "
                      + "vous pr\u00e9f\u00e9rez ; il sera remplac\u00e9 au prochain changement de "
                      + "palette.</p><p>Les identifiants existants ne sont jamais \u00e9cras\u00e9s : un "
                      + "suffixe num\u00e9rique est ajout\u00e9 \u00e0 tout le groupe d'un coup, pour que le "
                      + "jeu reste toujours coh\u00e9rent.</p>",
      lumNote:        "<p>La luminosit\u00e9 CIE L*a*b* du r\u00e9sultat couleur, extraite comme couche \u00e0 "
                      + "part en niveaux de gris, nomm\u00e9e <i>nom</i>_L. Parce que c'est une "
                      + "luminosit\u00e9 standard, elle se comporte dans une combinaison LRGB, dans "
                      + "un masque ou dans une courbe exactement comme n'importe quelle autre "
                      + "luminance.</p><p>Pour la stretcher, mettez la <b>cible</b> de l'aper\u00e7u "
                      + "sur <b>Luminance</b> et servez-vous de l'histogramme sous l'aper\u00e7u : il "
                      + "se rapporte \u00e0 l'image affich\u00e9e, et cette couche conserve ses trois "
                      + "marqueurs \u00e0 elle.</p>",
      scnrNote:       "<p>Le processus <b>SCNR</b> standard, en neutre moyen, appliqu\u00e9 \u00e0 la "
                      + "n\u00e9buleuse seule. Le vert est retir\u00e9 directement ; le magenta est du "
                      + "vert dans l'inverse.</p>",
      starsNote:      "<p>Le champ d'\u00e9toiles est une combinaison fixe de type large bande "
                      + ":<br/>&nbsp;&nbsp;R = 0.5&middot;Ha + 0.5&middot;Sii&nbsp;&nbsp;&nbsp;G "
                      + "= 0.3&middot;Ha + 0.7&middot;Oiii&nbsp;&nbsp;&nbsp;B = Oiii</p><p>Les "
                      + "\u00e9toiles sont des sources large bande, pas des \u00e9metteurs de raies : les "
                      + "m\u00e9langer ainsi donne une couleur plus cr\u00e9dible que de passer la palette "
                      + "de la n\u00e9buleuse par-dessus.</p>",
      styleNote:      "<p>Une seule liste pour la palette et son point de d\u00e9part : choisir une "
                      + "entr\u00e9e fixe d'un coup le mappage des couches, tous les curseurs de "
                      + "r\u00e9glage et le nom de l'image de sortie. Vous restez libre de bouger "
                      + "ensuite n'importe quel curseur.</p><p>Les entr\u00e9es <b>Foraxx</b> "
                      + "m\u00e9langent le rouge et le vert entre deux sources \u00e0 l'aide de masques "
                      + "dynamiques : la palette change donc d'un bout \u00e0 l'autre de l'image. Les "
                      + "autres sont des mappages fixes : les trois lettres donnent dans l'ordre "
                      + "la source de R, G et B, si bien que <b>HSO</b> signifie rouge depuis "
                      + "Ha, vert depuis Sii, bleu depuis Oiii.</p><p><b>Andy Warhol</b> pousse "
                      + "la saturation \u00e0 fond et post\u00e9rise le r\u00e9sultat en aplats de couleur, "
                      + "comme une s\u00e9rigraphie.</p><p>Les entr\u00e9es qui ont besoin de Sii sont "
                      + "cach\u00e9es tant que vous \u00eates en mode 2 couches.</p>",
      noticeLevelsReset: "Image source chang\u00e9e - niveaux r\u00e9initialis\u00e9s (%s).",
      noticeCreated:  "Images cr\u00e9\u00e9es : %s. Changez de palette et relancez, ou Fermer.",
      normalizeBarTip: "<p>Am\u00e8ne les couches \u00e0 une luminosit\u00e9 commune avant leur combinaison, en "
                      + "suivant la m\u00e9thode publi\u00e9e de normalisation des couches en bande "
                      + "\u00e9troite.</p><p>Chaque couche re\u00e7oit un point noir interpol\u00e9 entre son "
                      + "minimum et sa m\u00e9diane, puis une courbe de tons moyens qui am\u00e8ne sa "
                      + "m\u00e9diane sur celle de la couche de r\u00e9f\u00e9rence - un stretch par courbe, "
                      + "pas une mise \u00e0 l'\u00e9chelle lin\u00e9aire : la structure t\u00e9nue est relev\u00e9e sans "
                      + "que les c\u0153urs brillants s'emballent.</p><p>C'est le vrai rem\u00e8de \u00e0 un "
                      + "SHO qui ressort massivement vert : Ha est en g\u00e9n\u00e9ral plusieurs fois "
                      + "plus fort que Sii et Oiii, et aucune correction de couleur pixel par "
                      + "pixel effectu\u00e9e ensuite ne peut d\u00e9faire cela. Corrigez l'\u00e9quilibre "
                      + "d'abord, et la palette se tient.</p>",
      scnrBarTip:     "<p>Active ou saute toute l'\u00e9tape de suppression de couleur.</p><p>Elle "
                      + "s'applique \u00e0 la <b>n\u00e9buleuse seule</b>. Les \u00e9toiles ont leur propre "
                      + "suppression du vert dans la section \u00c9toiles, car cette correction est "
                      + "r\u00e9gl\u00e9e pour le vert issu du d\u00e9s\u00e9quilibre des couches et aplatirait en "
                      + "gris la vraie couleur large bande des \u00e9toiles.</p>",
      hdrBarTip:      "<p>Active ou saute d'un bloc la compression des hautes lumi\u00e8res, "
                      + "HDRMultiscaleTransform et le contraste local. D\u00e9sactiv\u00e9 par d\u00e9faut, "
                      + "avec toutes les quantit\u00e9s \u00e0 z\u00e9ro.</p>",
      lumBarTip:      "<p>Produit une couche de luminance de synth\u00e8se \u00e0 partir des couches en "
                      + "bande \u00e9troite, nomm\u00e9e <i>nom</i>_L.</p>",
      normalizeRef:   "R\u00e9f\u00e9rence :",
      normalizeRefTip: "<p>La couche \u00e0 laquelle toutes les autres sont remont\u00e9es. Ha est presque "
                      + "toujours la plus forte : c'est la r\u00e9f\u00e9rence habituelle.</p>",
      styleForaxxClassic: "Foraxx - classique (starless identique \u00e0 l'original)",
      styleForaxxClean: "Foraxx - avec nettoyage des couleurs (recommand\u00e9)",
      styleForaxxSoft: "Foraxx - transition douce",
      styleForaxxGold: "Foraxx - or dominant",
      styleForaxxTeal: "Foraxx - turquoise dominant",
      styleForaxxHOO: "Foraxx HOO - dynamique, Ha et Oiii seulement",
      styleWarhol:    "Andy Warhol - couleur d'affiche",
      styleSHO:       "SHO (Hubble)",
      styleHSO:       "HSO",
      styleHOS:       "HOS",
      styleOHS:       "OHS",
      styleOSH:       "OSH",
      styleSOH:       "SOH",
      styleHOO:       "HOO (bicolore)",
      styleOHH:       "OHH",

      // --- infobulles des contrôles simples --------------------------------
      threeChannelRadioTip: "<p>Vous avez collect\u00e9 Sii, Ha et Oiii. Toutes les palettes sont "
                      + "disponibles.</p>",
      twoChannelRadioTip: "<p>Donn\u00e9es OSC duo-bande, ou mono Ha et Oiii seulement. Les lignes Sii "
                      + "sont d\u00e9sactiv\u00e9es, et la liste des palettes se limite aux mappages qui "
                      + "n'ont pas besoin de Sii.</p><p>Si une palette Sii est s\u00e9lectionn\u00e9e au "
                      + "moment o\u00f9 vous choisissez ceci, elle bascule vers Foraxx HOO - la "
                      + "premi\u00e8re entr\u00e9e qui fonctionne sans Sii, et non un mappage \u00e0 deux "
                      + "couches correspondant. Choisissez ensuite celle que vous voulez.</p>",
      reloadTip:      "<p>Relit l'espace de travail. \u00c0 utiliser si vous avez cr\u00e9\u00e9 ou renomm\u00e9 des "
                      + "images apr\u00e8s avoir ouvert ce dialogue.</p>",
      previewTargetTip: "<p>Quelle image afficher, et \u00e0 quelle image se rapporte l'histogramme "
                      + "ci-dessous. Chacune des trois porte son propre point noir, ses tons "
                      + "moyens et son point blanc ; changer de cible ici ram\u00e8ne les marqueurs de "
                      + "cette image, et chaque jeu n'est appliqu\u00e9 qu'\u00e0 sa propre image lorsque "
                      + "vous pressez Ex\u00e9cuter.</p><p><b>Luminance</b> est la couche L extraite. "
                      + "Vous pouvez la regarder sans activer la section Luminance artificielle - "
                      + "elle n'est \u00e9crite en sortie que si cette section est active.</p>",
      previewDetailTip: "<p>L'\u00e9chantillonnage auquel la cha\u00eene de traitement tourne r\u00e9ellement. Le "
                      + "changer <i>relance</i> bien le calcul.</p><p><b>Auto</b> calcule au "
                      + "double de la r\u00e9solution du panneau : un zoom \u00e0 200 % reste exact au pixel "
                      + "pr\u00e8s. Choisissez 1:1 pour inspecter le vrai r\u00e9sultat - c'est lent sur une "
                      + "grande image et cela consomme beaucoup de m\u00e9moire.</p>",
      refreshTip:     "<p>Relance maintenant le calcul de l'aper\u00e7u, en relisant et en remesurant "
                      + "les images sources.</p><p>\u00c0 utiliser apr\u00e8s avoir modifi\u00e9 une couche dans "
                      + "PixInsight : l'aper\u00e7u travaille sur ses propres copies "
                      + "sous-\u00e9chantillonn\u00e9es, et rien d'autre ne les lib\u00e8re tant que l'image "
                      + "garde son identifiant.</p>",
      levelsTip:      "<p>Histogramme de l'image affich\u00e9e dans l'aper\u00e7u, telle qu'elle est juste "
                      + "avant sa propre transformation de niveaux, trac\u00e9 en un contour par couche "
                      + "sur une \u00e9chelle verticale logarithmique.</p><p>Faites glisser les trois "
                      + "triangles : le sombre \u00e0 gauche est le point noir, le gris au milieu "
                      + "l'\u00e9quilibre des tons moyens, le clair \u00e0 droite le point blanc. "
                      + "Double-cliquez sur un triangle pour ne r\u00e9initialiser que "
                      + "celui-l\u00e0.</p><p><b>Chaque image conserve ses trois marqueurs.</b> Changez "
                      + "la cible de l'aper\u00e7u et ce panneau bascule sur le jeu de cette image ; \u00e0 "
                      + "l'ex\u00e9cution, chaque jeu est appliqu\u00e9 \u00e0 sa propre image et \u00e0 aucune "
                      + "autre.</p>",
      levelsReadoutTip: "<p>Point noir, \u00e9quilibre des tons moyens et point blanc de l'image "
                      + "affich\u00e9e dans l'aper\u00e7u.</p>",
      levelsAutoTip:  "<p>Lit un point de d\u00e9part sur l'histogramme courant : \u00e9cr\u00eate le point noir "
                      + "juste en dessous du d\u00e9but du signal r\u00e9el, et place la m\u00e9diane \u00e0 un "
                      + "confortable 0.30.</p><p>S'applique \u00e0 l'image affich\u00e9e dans l'aper\u00e7u.</p>",
      levelsResetTip: "<p>Remet les trois marqueurs de cette image \u00e0 noir 0, moyen 0.5, blanc 1 - "
                      + "une transformation identit\u00e9. Les autres images gardent les leurs.</p>",
      newInstanceTip: "<p>Nouvelle instance - faites glisser ce bouton sur l'espace de travail "
                      + "pour enregistrer les r\u00e9glages actuels sous forme d'ic\u00f4ne de processus.</p>",
      resetAllTip:    "<p>Remet chaque curseur et chaque case \u00e0 cocher \u00e0 sa valeur d'usine. Votre "
                      + "s\u00e9lection de couches est conserv\u00e9e.</p>",
      executeTip:     "<p>Construit les images en pleine r\u00e9solution avec les r\u00e9glages "
                      + "actuels.</p><p>Le dialogue reste ouvert : vous pouvez changer de palette "
                      + "et relancer. Chaque ex\u00e9cution re\u00e7oit son propre jeu de noms d'images.</p>",
      cancelTip:      "<p>Ferme le dialogue. Tout ce que vous avez d\u00e9j\u00e0 construit avec Ex\u00e9cuter "
                      + "reste en place.</p>",

      // --- cases à cocher --------------------------------------------------
      starlessOnlyTip: "<p>Cochez ceci si vos images contiennent encore les \u00e9toiles, ou si vous ne "
                      + "voulez pas d'image d'\u00e9toiles couleur s\u00e9par\u00e9e. Les colonnes d'\u00e9toiles et "
                      + "toute la section \u00c9toiles sont d\u00e9sactiv\u00e9es.</p>",
      starCleanGreen: "Retirer le vert des \u00e9toiles",
      starCleanGreenTip: "<p>Une suppression du vert en deux passes : retirer le vert, pousser "
                      + "fortement vers les hautes lumi\u00e8res avec un transfert des tons moyens, "
                      + "retirer \u00e0 nouveau le vert sur les donn\u00e9es stretch\u00e9es, puis annuler la "
                      + "pouss\u00e9e. C'est de travailler sur la version stretch\u00e9e qui permet \u00e0 la "
                      + "seconde passe d'atteindre les franges t\u00e9nues que la premi\u00e8re laisse "
                      + "passer.</p><p>La section <b>Suppression du vert et du magenta</b> "
                      + "ci-dessous ne touche pas du tout aux \u00e9toiles : cette correction est "
                      + "r\u00e9gl\u00e9e pour le vert issu du d\u00e9s\u00e9quilibre des couches, et sur un champ "
                      + "d'\u00e9toiles elle aplatit en gris la vraie couleur large bande des "
                      + "\u00e9toiles.</p>",
      scnrPreserveL:  "Pr\u00e9server la luminosit\u00e9",
      scnrPreserveLTip: "<p>Conserve la luminosit\u00e9 du pixel l\u00e0 o\u00f9 elle \u00e9tait une fois la dominante "
                      + "retir\u00e9e, ce qui emp\u00eache le r\u00e9sultat de devenir plat et terne.</p>",
      makeCombined:   "Cr\u00e9er aussi une combinaison en mode \u00e9cran des images starless et \u00e9toiles",
      makeCombinedTip: "<p>Produit <i>nom</i>_combined selon ~(~starless * ~stars) - le m\u00e9lange en "
                      + "mode \u00e9cran - une fois les niveaux appliqu\u00e9s \u00e0 chacune d'elles. Le "
                      + "r\u00e9sultat ne se voit qu'apr\u00e8s Ex\u00e9cuter : l'aper\u00e7u n'a plus de cible "
                      + "combin\u00e9e.</p>",
      makeFactors:    "Conserver les images des facteurs dynamiques",
      makeFactorsTip: "<p>Les masques dont le m\u00e9lange dynamique est construit, \u00e9crits comme "
                      + "images pour inspection ou pour \u00eatre r\u00e9utilis\u00e9s comme masques "
                      + "ailleurs.</p>"
                      + "<p>Une palette \u00e0 trois couches en produit deux, <i>nom</i>_o et "
                      + "<i>nom</i>_ho ; une palette \u00e0 deux couches n'a pas de Sii dont s'\u00e9carter, "
                      + "elle ne produit donc que _ho. Sur un mappage fixe elles sont \u00e9crites "
                      + "mais rien ne les utilise, la quantit\u00e9 de Foraxx y \u00e9tant tenue \u00e0 0.</p>",
      autoPreview:    "Auto",
      autoPreviewTip: "<p>Relance automatiquement le calcul de l'aper\u00e7u peu apr\u00e8s qu'un r\u00e9glage "
                      + "s'est stabilis\u00e9. D\u00e9sactivez-le sur les tr\u00e8s grandes images et utilisez "
                      + "plut\u00f4t Rafra\u00eechir.</p>",

      // --- curseurs : libellé et infobulle, sur le nom de la ligne ---------
      normSii:        "Niveau Sii :",
      normSiiTip:     "<p>O\u00f9 se place la m\u00e9diane de Sii, en multiple de celle de la couche "
                      + "de r\u00e9f\u00e9rence.</p><p>1.00 l'aligne exactement. En dessous de 1, Sii "
                      + "reste plus sombre que Ha ; au-dessus de 1, il est pouss\u00e9 plus clair.</p>",
      normHa:         "Niveau Ha :",
      normHaTip:      "<p>O\u00f9 se place la m\u00e9diane de Ha, en multiple de celle de la couche de "
                      + "r\u00e9f\u00e9rence. Avec Ha comme r\u00e9f\u00e9rence, 1.00 la laisse exactement telle "
                      + "quelle.</p>",
      normOiii:       "Niveau Oiii :",
      normOiiiTip:    "<p>O\u00f9 se place la m\u00e9diane d'Oiii, en multiple de celle de la couche "
                      + "de r\u00e9f\u00e9rence.</p><p>Oiii est en g\u00e9n\u00e9ral la couche la plus faible, et "
                      + "c'est ce curseur qui d\u00e9cide de la quantit\u00e9 de turquoise que prendra la "
                      + "palette.</p>",
      normShadow:     "Point des basses lumi\u00e8res :",
      normShadowTip:  "<p>O\u00f9 se situe le point noir, interpol\u00e9 entre le pixel le plus sombre de "
                      + "chaque couche et sa m\u00e9diane.</p><p>0 le place exactement sur le minimum "
                      + "et ne perd rien. Le relever assombrit le fond de ciel avant l'alignement "
                      + "des niveaux.</p>",
      gainSii:        "Pond\u00e9ration Sii :",
      gainSiiTip:     "<p>Pond\u00e9ration appliqu\u00e9e \u00e0 Sii avant la combinaison.</p><p>C'est un gain "
                      + "doux, g&middot;x / (1 + (g-1)&middot;x). Il laisse 0 \u00e0 0 et 1 \u00e0 1 : "
                      + "relever une couche \u00e9claircit le signal faible sans jamais \u00e9cr\u00eater les "
                      + "c\u0153urs brillants, ce que ferait une simple multiplication.</p>",
      gainHa:         "Pond\u00e9ration Ha :",
      gainHaTip:      "<p>Pond\u00e9ration appliqu\u00e9e \u00e0 Ha avant la combinaison. Gain doux, sans "
                      + "\u00e9cr\u00eatage des hautes lumi\u00e8res.</p><p>Sur une palette Foraxx, Ha "
                      + "alimente le masque ho autant que les deux emplacements m\u00e9lang\u00e9s : le "
                      + "relever repousse vers l'ext\u00e9rieur la fronti\u00e8re or / turquoise. Sur un "
                      + "mappage fixe, il n'\u00e9claircit que l\u00e0 o\u00f9 ce mappage place Ha.</p>",
      gainOiii:       "Pond\u00e9ration Oiii :",
      gainOiiiTip:    "<p>Pond\u00e9ration appliqu\u00e9e \u00e0 Oiii avant la combinaison. Gain doux, sans "
                      + "\u00e9cr\u00eatage des hautes lumi\u00e8res.</p><p>Sur une palette Foraxx, Oiii "
                      + "alimente les deux masques dynamiques autant que l'emplacement d'ancrage : "
                      + "c'est le curseur qui p\u00e8se le plus sur l'endroit o\u00f9 la palette bascule de "
                      + "l'or au turquoise. Sur un mappage fixe, il n'\u00e9claircit que l\u00e0 o\u00f9 ce "
                      + "mappage place Oiii.</p>",
      blend:          "Quantit\u00e9 de Foraxx :",
      blendTip:       "<p>Interpole entre le mappage fixe ordinaire et le m\u00e9lange dynamique "
                      + "complet.</p><p>0.00 donne le mappage ordinaire, 1.00 le r\u00e9sultat Foraxx "
                      + "classique.</p><p><b>Palettes Foraxx uniquement.</b> Un mappage fixe comme "
                      + "SHO ou HOO est une simple permutation des couches : il n'y a rien \u00e0 "
                      + "interpoler, et ce curseur comme les deux curseurs de transition sont "
                      + "gris\u00e9s.</p>",
      hardO:          "Transition Sii/Ha :",
      hardOTip:       "<p>Duret\u00e9 du masque \u00ab o \u00bb, o = Oiii^(k&middot;~Oiii), qui d\u00e9cide o\u00f9 le "
                      + "rouge vient de Sii et o\u00f9 il vient de Ha.</p><p>1.00 est la valeur "
                      + "d'origine. Les valeurs plus hautes retardent et durcissent la bascule ; "
                      + "les plus basses l'avancent et l'adoucissent.</p><p><b>Foraxx \u00e0 trois "
                      + "couches uniquement</b> - il faut un Sii d'o\u00f9 partir, et un mappage fixe "
                      + "n'a pas de transition.</p>",
      hardHO:         "Transition Ha/Oiii :",
      hardHOTip:      "<p>Duret\u00e9 du masque \u00ab ho \u00bb, ho = "
                      + "(Ha&middot;Oiii)^(k&middot;~(Ha&middot;Oiii)), qui pilote la couche verte "
                      + "et donc la fronti\u00e8re or / turquoise.</p><p>C'est en g\u00e9n\u00e9ral le curseur "
                      + "le plus lourd de cons\u00e9quences ici.</p><p><b>Palettes Foraxx "
                      + "uniquement</b> - un mappage fixe n'a pas de transition \u00e0 modeler.</p>",
      curveStrength:  "Courbes signature :",
      curveStrengthTip: "<p>Met \u00e0 l'\u00e9chelle les deux courbes de teinte du script d'origine, en les "
                      + "rapprochant ou en les \u00e9loignant de la transformation identit\u00e9.</p><p>Elles "
                      + "agissent sur la teinte, pas sur la luminosit\u00e9 : elles font tourner les "
                      + "rouges vers l'or et les bleus vers le turquoise, et comptent pour beaucoup "
                      + "dans l'allure d'une image Foraxx.</p>",
      satStrength:    "Saturation s\u00e9lective :",
      satStrengthTip: "<p>Met \u00e0 l'\u00e9chelle la courbe de saturation globale et les deux passes de "
                      + "saturation s\u00e9lective, qui renforcent une bande \u00e9troite de dor\u00e9s et une "
                      + "bande \u00e9troite de bleus en laissant intact tout ce qui se trouve entre les "
                      + "deux.</p>",
      extraSaturation: "Saturation globale :",
      extraSaturationTip: "<p>Un renfort de saturation uniforme sur toutes les teintes, par-dessus la "
                      + "passe s\u00e9lective ci-dessus.</p><p>0 n'y touche pas. C'est ce qui donne \u00e0 "
                      + "la palette Andy Warhol sa couleur d'affiche.</p>",
      posterLevels:   "Niveaux de post\u00e9risation :",
      posterLevelsTip: "<p>Quantifie chaque couche sur ce nombre de niveaux r\u00e9guli\u00e8rement "
                      + "espac\u00e9s : les d\u00e9grad\u00e9s deviennent des aplats de couleur - l'effet "
                      + "s\u00e9rigraphie.</p><p>0 d\u00e9sactive. De 4 \u00e0 8 donne une affiche "
                      + "reconnaissable ; au-del\u00e0, l'effet est plus subtil.</p>",
      starStretch:    "Luminosit\u00e9 des \u00e9toiles :",
      starStretchTip: "<p>Un stretch hyperbolique, ((3^k)&middot;$T) / ((3^k-1)&middot;$T+1) - la "
                      + "fonction de transfert des tons moyens avec m = 1/(1+3^k). Il fixe 0 et 1 "
                      + "et reste monotone : il rel\u00e8ve fortement les \u00e9toiles faibles sans jamais "
                      + "\u00e9cr\u00eater un c\u0153ur brillant. 0 les laisse exactement telles que la "
                      + "combinaison les a produites.</p><p>1.00 est un rel\u00e8vement doux, adapt\u00e9 \u00e0 "
                      + "des \u00e9toiles d\u00e9j\u00e0 stretch\u00e9es, ce que ce script attend.</p><p>\u00c0 5.00 le "
                      + "multiplicateur vaut 243 : sur une frame d'\u00e9toiles dont le fond est "
                      + "d\u00e9j\u00e0 \u00e0 0.02, cela le porte \u00e0 0.83, et \u00e0 0.05 il monte \u00e0 0.93 - un "
                      + "ciel blanc dans les deux cas. Ne l'augmentez que si vos \u00e9toiles sont "
                      + "vraiment encore faibles, et surveillez l'aper\u00e7u.</p>",
      starSaturation: "Couleur des \u00e9toiles :",
      starSaturationTip: "<p>Un renfort de saturation pond\u00e9r\u00e9 par la teinte, appliqu\u00e9 apr\u00e8s le "
                      + "stretch de luminosit\u00e9. C'est lui qui fait ressortir l'\u00e9talement bleu / "
                      + "blanc / ambre d'un champ d'\u00e9toiles.</p><p>0 ne touche pas \u00e0 la couleur. "
                      + "1.00 est un bon point de d\u00e9part une fois la luminosit\u00e9 l\u00e0 o\u00f9 vous la "
                      + "voulez.</p>",
      scnrGreen:      "Quantit\u00e9 de vert :",
      scnrGreenTip:   "<p>La quantit\u00e9 pour la passe verte. 0 d\u00e9sactive, 1 retire tout l'exc\u00e8s "
                      + "d\u00e9tect\u00e9.</p>",
      scnrMagenta:    "Quantit\u00e9 de magenta :",
      scnrMagentaTip: "<p>La quantit\u00e9 pour la passe magenta, ex\u00e9cut\u00e9e en inversion, suppression "
                      + "du vert, inversion.</p>",
      hdrAmount:      "Compression des hautes lumi\u00e8res :",
      hdrAmountTip:   "<p>Ram\u00e8ne vers le coude les tons situ\u00e9s au-dessus de lui. Rien de ce qui "
                      + "est sous le coude n'est touch\u00e9.</p><p>La correction est calcul\u00e9e sur la "
                      + "luminance et appliqu\u00e9e comme un facteur d'\u00e9chelle unique aux trois "
                      + "couches : la teinte et la saturation en sortent intactes. Enti\u00e8rement "
                      + "invariante d'\u00e9chelle, donc l'aper\u00e7u correspond exactement \u00e0 l'image "
                      + "finale.</p>",
      hdrKnee:        "Coude de compression :",
      hdrKneeTip:     "<p>La luminosit\u00e9 \u00e0 partir de laquelle la compression commence. Tout ce qui "
                      + "est plus sombre est laiss\u00e9 enti\u00e8rement tranquille.</p><p>Abaissez-le pour "
                      + "descendre plus loin dans les tons moyens, relevez-le pour n'agir que sur "
                      + "les c\u0153urs les plus brillants.</p>",
      hdrLayers:      "Couches multi-\u00e9chelles HDR :",
      hdrLayersTip:   "<p>Applique une transformation HDR multi-\u00e9chelle avec ce nombre de couches. "
                      + "0 la saute.</p><p>Bien plus efficace qu'une courbe sur des c\u0153urs "
                      + "r\u00e9ellement cram\u00e9s, mais elle travaille sur des \u00e9chelles spatiales : \u00e0 "
                      + "l'\u00e9chantillonnage r\u00e9duit de l'aper\u00e7u, elle ne peut \u00eatre qu'indicative. "
                      + "V\u00e9rifiez le r\u00e9sultat \u00e0 1:1, ou apr\u00e8s Ex\u00e9cuter.</p>",
      localContrast:  "Contraste local :",
      localContrastTip: "<p>Un masque flou \u00e0 grande \u00e9chelle sur la luminance, pour restituer la "
                      + "structure que la compression des hautes lumi\u00e8res aplatit. D\u00e9pend lui "
                      + "aussi de l'\u00e9chelle, donc l'aper\u00e7u n'est qu'indicatif.</p>",
      lumApply:       "Appliquer \u00e0 l'image :",
      lumApplyTip:    "<p>Quelle part de la luminance artificielle est substitu\u00e9e dans l'image "
                      + "couleur.</p><p>0 produit la couche et laisse l'image couleur intacte, \u00e0 "
                      + "vous de les combiner vous-m\u00eame. 1 remplace enti\u00e8rement la luminosit\u00e9 "
                      + "propre de l'image. Les rapports de couleur sont pr\u00e9serv\u00e9s dans les deux "
                      + "cas, et la substitution s'arr\u00eate l\u00e0 o\u00f9 une couche \u00e9cr\u00eaterait.</p>",

      // --- fragments partagés -----------------------------------------------
      rangeNote:      "Plage de %s \u00e0 %s. Le bouton \u00e0 gauche remet le curseur \u00e0 la valeur de "
                    + "d\u00e9part de la palette.",
      resetToPalette: "Remettre \u00e0 la valeur de d\u00e9part de la palette."
   }
};

/*
 * The one accessor. Falls back to English for a key the current language has
 * not been given, and returns the key itself if neither has it - visible in the
 * interface, which is the point: a missing string should look wrong rather than
 * render as an empty label nobody notices.
 */
function fxT( key )
{
   let t = FX_UI[ FX.lang ] || FX_UI.en;
   if ( t[key] !== undefined )
      return t[key];
   if ( FX_UI.en[key] !== undefined )
      return FX_UI.en[key];
   return key;
}

#endif   // __FX_Strings_js
