# Pinia Store Follow-ups

Diese Kandidaten sind bewusst nicht Teil von Issue #43, bleiben aber gute
nächste Schritte:

- `localeStore` als Alternative zu `useAppI18n`, falls mehrere Features
  künftig explizit auf Sprachwechsel reagieren sollen.
- `themeStore` als Alternative zu `useThemePreference`, falls Theme-Logik
  mit weiteren UI-Präferenzen gebündelt werden soll.
- `avatarErrorStore`, wenn Avatar-Fehlerzustände in mehreren Ansichten
  konsistent wiederverwendet werden.

Status: nur bei wachsendem Cross-Component-State umsetzen.
