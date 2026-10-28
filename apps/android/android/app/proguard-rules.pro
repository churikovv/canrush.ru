# Release build is minified by R8 (app/build.gradle) for Google Play's DEX optimization check.
# Capacitor ships consumer rules for @CapacitorPlugin classes, @PluginMethod methods and plugin callbacks, so the
# app's own plugins (CanrushBars, CanrushImage, CanrushPush, TelegramLinks) need nothing here; MainActivity and the
# RuStore messaging service are kept through the manifest. Add a rule only for a crash reproduced in a release build,
# and keep it narrow (one class or package) — a broad -keep drops the obfuscation score again.

# Readable crash stack traces with the mapping file uploaded to Play; file names are hidden.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
