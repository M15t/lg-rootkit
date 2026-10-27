# webOS 26 Homescreen Customization

Non-destructive bind-mount overlay for customizing the LG webOS 26 homescreen.

## Environment

- **webOS**: 11.2.0 (platform 11, build 3706, codename Rockhopper/qilian)
- **Chassis**: W25G, 4K panel (3840×2160)
- **Home app**: `com.webos.app.home` — Flutter-based (`libapp.so` + XML layout + ASTC textures)
- **Prerequisites**: Rooted TV with Homebrew Channel, SSH access, [nospy](https://github.com/nickneos/LifesGoodWithoutSpying) app installed (blocks LG telemetry + promo feeds)

## What's Possible vs Not

### Achievable (XML / asset overlay)

| Customization | Method |
|---|---|
| Custom background image | Replace `bg_banner_img.astc` hero banner texture |
| Remove hero promo text | Edit i18n locale JSON (empty the strings) |
| Remove Q-card shelf | Remove `qcardList` item from `home.xml` |
| Remove recommended shelf | Remove `recommendedShelf` item from `home.xml` |
| Adjust app row position | Tweak `herobanner` / `appList` / `margin` heights in `home.xml` |

### Not Possible (hardcoded in Flutter `libapp.so`)

- **Top-left menu cluster** (`TopGlobalLineWidget` / `GlobalActionButtons`) — embedded in HeroBanner widget, not in XML
- **Horizontal centering of app row** — layout offsets hardcoded
- **App icon size** — governed by `DimensConfig` presets (webos24/25 variants only, none smaller)
- **Clock overlay** — `<time>` component only exists in senior layout, not selectable via XML

## How It Works

The technique **never modifies** the original read-only system files. Instead:

1. Copy the entire assets directory to `/tmp/weboshome-merged/`
2. Overlay modified files (layout XML, textures, i18n JSON)
3. `mount --bind` the merged directory over the original path
4. Kill the home app so it restarts and loads the overlaid assets

On reboot, the bind mount disappears and the TV returns to stock — unless autostart is configured.

## File Structure on TV

```
/media/developer/apps/usr/palm/applications/tld.my.customhome/
├── apply.sh                    # Main overlay script
├── restore.sh                  # Restore to stock
└── assets/
    ├── home.xml                # Modified layout
    ├── images/
    │   └── bg_banner_img.astc  # Custom background (ASTC 5×4)
    └── i18n/
        └── vi.json             # Locale with emptied hero strings
```

Autostart symlink:
```
/var/lib/webosbrew/init.d/49-custom-homescreen → .../tld.my.customhome/apply.sh
```

## Layout: `home.xml`

The active layout uses `overlay` window type with a 2-page vertical flow:

```xml
<?xml version="1.0" encoding="utf-8"?>
<home version="2.0">
  <layout windowType="overlay" pageType="none" pageCount="2" defaultPage="1">
    <page pageBodyType="container">
      <item id="mypage" itemWidth="3840" itemHeight="2160"
            focusType="scope" autoFocus="false"/>
    </page>
    <page pageBodyType="container">
      <item id="herobanner" itemWidth="3840" itemHeight="1872"
            focusType="scope" autoFocus="false"/>
      <item id="appList" itemWidth="3840" itemHeight="252"
            focusType="scope" autoFocus="true"/>
      <item id="margin" itemWidth="3840" itemHeight="36"
            focusType="none"/>
    </page>
  </layout>
</home>
```

Heights sum to 2160 (1872 + 252 + 36). The `herobanner` height must match the background image height to eliminate black gaps. `qcardList` and `recommendedShelf` items were removed entirely.

**Note**: `itemY` has no effect — the layout is vertical flow, items stack top-to-bottom. Only heights control positioning.

## ASTC Image Pipeline

The hero banner texture uses ASTC format (magic `0x5CA1AB13`, block size 5×4).

### Encoding a custom background

```sh
# 1. Crop source image to match herobanner height (top-anchored)
ffmpeg -i source.jpg -vf "crop=3840:1872:0:0" -y cropped.png

# 2. Encode to ASTC 5×4 (ARM astcenc, medium quality)
astcenc -cl cropped.png bg_banner_img.astc 5x4 -medium
```

The same ASTC file is deployed into all three resolution buckets (`hd/`, `2k/`, `4k/`) since the 4K panel is the target.

### Getting `astcenc`

Download the ARM `astcenc` CLI from [ARM-software/astc-encoder](https://github.com/ARM-software/astc-encoder/releases) (v5.7.0+). macOS: use the `astcenc-universal` binary from the macOS release archive.

## Hero Text Removal (i18n)

The hero banner's text ("Start a new experience with webOS." / "Go to Apps") is localized. To hide it, empty those values in the locale JSON the home app actually loads.

### Which locale file is loaded

The home app loads the JSON matching the **UI locale**, including its region variant. Check the current UI locale:

```sh
cat /var/luna/preferences/localeInfo   # look at locales.UI, e.g. "en-GB"
```

The locale maps to a filename with an underscore:

| UI locale | File loaded |
|---|---|
| `vi-VN` | `vi.json` |
| `en-GB` | `en_GB.json` |
| `en-US` | `en.json` (or `en_US.json`) |

Editing `en.json` has **no effect** when the UI is set to `en-GB` — that variant reads `en_GB.json`. Empty the strings in the exact file for the active locale (and any locale you plan to switch to):

```sh
# For each target locale file (vi.json, en_GB.json, ...):
sed -i 's/"Start a new experience with webOS.": "[^"]*"/"Start a new experience with webOS.": ""/' en_GB.json
sed -i 's/"Go to Apps": "[^"]*"/"Go to Apps": ""/' en_GB.json
```

The key names are English regardless of locale — only the values are translated. `apply.sh` copies **every** `*.json` in the override `i18n/` dir, so adding a new locale just means dropping its edited file in.

### Preserve the i18n symlink (do NOT replace it with a copy)

`assets/i18n` is a symlink to `/mnt/lg/wee/ui_l10n/.../i18n`, the system's live locale store. The naive approach — replacing the symlink with a frozen directory copy — **breaks system language switching**: the TV's Settings > Language panel hangs on "loading" because the home app's assets now shadow the live store with stale files.

Instead, dereference the symlink target **inside the overlay only** (the merged `/tmp` tree), patch the locale files there, and leave the real symlink target at `/mnt/lg/wee/...` untouched. Never bind-mount a file onto a path under `/mnt/lg/wee/ui_l10n/...` — that is a system-wide locale path and overlaying it there breaks locale loading for every app, not just Home.

## Feed Blocking

The hero banner shows **dynamic network promo content** from `homeprv.lgtvcommon.com` when reachable. The promo carries its **own text** (independent of the i18n files), so emptying the locale strings only hides the text once the hero falls back to the **local default banner** — which happens when the promo domain is blocked. The SAM log confirms the fallback: `NL_HERO_SHOWN {"hero_type":"default banner"}` means local; a network promo logs a different `hero_type`.

Two blockers are in play on this TV, and they are **not** the same list:

- **nospy** (`ooo.lew.lifesgoodwithoutspying`) sinkholes ~71 ad/telemetry domains via an `/etc/hosts` bind-mount (autostart init.d `50-lifesgoodwithoutspying`). Its list is ads/tracking only — it does **not** include `homeprv.lgtvcommon.com`.
- **Glasshouse** runs a local DNS filter (resolver at `::1`/`127.0.0.1`) that returns `NXDOMAIN` for platform domains including `homeprv.lgtvcommon.com`. This is what actually forces the hero to the local fallback. Its "EVERYTHING" ad-block mode blocks LG platform services too.

So the hero text staying hidden depends on Glasshouse's DNS filter (or any blocker that covers `homeprv`), not on nospy alone.

### Caveat: blocking breaks system language switching

Settings > Language loads its option lists from LG platform services. With Glasshouse set to **EVERYTHING** (or any block that covers those platform endpoints), the Language panel hangs on "loading" and selections do not apply. To change the UI language:

1. Temporarily lift the block — e.g. `umount /etc/hosts` (nospy) and set Glasshouse ad-block to OFF/ADS&TELEMETRY (not EVERYTHING).
2. Change the language in Settings.
3. Restore blocking — re-run `sh /var/lib/webosbrew/init.d/50-lifesgoodwithoutspying` and re-enable Glasshouse.
4. Restart Home (`pkill -f com.webos.app.home`). The hero promo is blocked again → local fallback → emptied i18n strings keep the text hidden.

While the block is lifted the network promo returns, so the hero text reappears until step 3–4.

## Scripts

### `apply.sh`

```sh
#!/bin/sh
set -e -x

ASSETS_DIR=/usr/palm/applications/com.webos.app.home/data/flutter_assets/assets
OVERRIDE_DIR=/media/developer/apps/usr/palm/applications/tld.my.customhome/assets

if grep -q " $ASSETS_DIR " /proc/mounts; then umount "$ASSETS_DIR"; fi

rm -rf /tmp/weboshome-merged
mkdir /tmp/weboshome-merged
cp -R --no-dereference "$ASSETS_DIR"/. /tmp/weboshome-merged/

cp "$OVERRIDE_DIR/home.xml" /tmp/weboshome-merged/home.xml

if [ -f "$OVERRIDE_DIR/images/bg_banner_img.astc" ]; then
    for r in hd 2k 4k; do
        cp "$OVERRIDE_DIR/images/bg_banner_img.astc" \
           "/tmp/weboshome-merged/images/$r/bg_banner_img.astc"
    done
fi

# Dereference the i18n symlink INSIDE the overlay only, then overlay every
# edited locale file. The real symlink target (/mnt/lg/wee/...) stays untouched
# so system language switching keeps working.
I18N_REAL=$(readlink -f /tmp/weboshome-merged/i18n)
if [ -d "$OVERRIDE_DIR/i18n" ]; then
    rm -f /tmp/weboshome-merged/i18n
    mkdir /tmp/weboshome-merged/i18n
    cp -R "$I18N_REAL"/. /tmp/weboshome-merged/i18n/
    for f in "$OVERRIDE_DIR"/i18n/*.json; do
        [ -f "$f" ] && cp "$f" /tmp/weboshome-merged/i18n/
    done
fi

mount --bind /tmp/weboshome-merged "$ASSETS_DIR"
pkill -f com.webos.app.home || true
```

**Safety**: the `grep -q /proc/mounts` check before `umount` prevents `set -e` from continuing past a failed unmount — without it, `rm -rf` could wipe a live overlay and cause a black screen.

**Why dereference inside the overlay**: `readlink -f` resolves the symlink to the live store, but the copy lands in `/tmp/weboshome-merged/i18n` (the overlay), so the home app sees patched locale files while every other app and the Settings language panel still read the untouched system store.

### `restore.sh`

```sh
#!/bin/sh
set -x
ASSETS_DIR=/usr/palm/applications/com.webos.app.home/data/flutter_assets/assets

rm -f /var/lib/webosbrew/init.d/49-custom-homescreen

if grep -q " $ASSETS_DIR " /proc/mounts; then
    umount "$ASSETS_DIR" 2>/dev/null || umount -l "$ASSETS_DIR" 2>/dev/null
fi

pkill -f com.webos.app.home 2>/dev/null || true
echo "RESTORED: custom homescreen removed, Home back to stock."
```

## Autostart

The overlay script runs at boot via Homebrew Channel's init.d:

```sh
ln -sf /media/developer/apps/usr/palm/applications/tld.my.customhome/apply.sh \
       /var/lib/webosbrew/init.d/49-custom-homescreen
```

Priority `49` ensures it runs before nospy's `50-lifesgoodwithoutspying`.

## Verification

```sh
# Check the overlay is active
grep "weboshome-merged" /proc/mounts

# Verify home app sees the modified assets
HOME_PID=$(pgrep -f com.webos.app.home | head -1)
md5sum /proc/$HOME_PID/root$ASSETS_DIR/home.xml
md5sum /proc/$HOME_PID/root$ASSETS_DIR/images/4k/bg_banner_img.astc

# Check SAM logs for home app launch
grep -E "NL_HERO_SHOWN|NL_SHELF_LIST_SHOWN" /var/log/messages | tail -5
```

## Restore to Stock

Run `restore.sh` on the TV or simply reboot (the bind mount is non-persistent without the autostart symlink):

```sh
sh /media/developer/apps/usr/palm/applications/tld.my.customhome/restore.sh
```

This removes the autostart symlink, unmounts the overlay, and restarts the home app with stock assets. Original system files are never touched.
