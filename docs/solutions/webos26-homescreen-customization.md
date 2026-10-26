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

The hero promo text is localized. To hide it, edit the locale JSON and empty the relevant strings:

```sh
# On the TV, copy the real i18n dir (it's a symlink to /mnt/lg/wee/ui_l10n/...)
cp -R /path/to/assets/i18n/. /tmp/i18n-edit/

# Empty the hero strings in the target locale (e.g., Vietnamese)
sed -i 's/"Start a new experience with webOS.": "[^"]*"/"Start a new experience with webOS.": ""/' vi.json
sed -i 's/"Go to Apps": "[^"]*"/"Go to Apps": ""/' vi.json
```

The key names are English regardless of locale — the values are translated.

## Feed Blocking (Already Handled)

The hero banner normally shows **dynamic network promo content** fetched from `homeprv.lgtvcommon.com`. When the domain is blocked, the home app falls back to the local `bg_banner_img.astc` texture — which is exactly what we replace.

The nospy app (`ooo.lew.lifesgoodwithoutspying`) already sinkholes 110+ LG domains including `homeprv.lgtvcommon.com`, `recommend.lgtvcommon.com`, and `nudge.lgtvcommon.com` via `/etc/hosts` bind-mount (autostart via init.d `50-lifesgoodwithoutspying`). No extra blocking needed.

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

if [ -f "$OVERRIDE_DIR/i18n/vi.json" ]; then
    rm -f /tmp/weboshome-merged/i18n
    mkdir /tmp/weboshome-merged/i18n
    cp -R "$ASSETS_DIR/i18n"/. /tmp/weboshome-merged/i18n/
    cp "$OVERRIDE_DIR/i18n/vi.json" /tmp/weboshome-merged/i18n/vi.json
fi

mount --bind /tmp/weboshome-merged "$ASSETS_DIR"
pkill -f com.webos.app.home || true
```

**Safety**: the `grep -q /proc/mounts` check before `umount` prevents `set -e` from continuing past a failed unmount — without it, `rm -rf` could wipe a live overlay and cause a black screen.

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
