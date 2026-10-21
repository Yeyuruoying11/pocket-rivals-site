// Pocket Rivals handheld simulator: m font glyph table (generated, do not edit)
//
// software/tools/make_font.py fills this from the "used characters" export
// (DEVICE.glyphs()) and DEVICE.exportStrings(): {char: base64 bitmap}, CJK
// 12x12 (18 bytes), ASCII 6x12 (9 bytes), rows top to bottom, MSB first.
// Until then it is null and device-core.js draws CJK with canvas fillText
// (lint "fallback") and ASCII with its built-in 5x9 glyphs.
window.DEVICE_FONT_M = null;
