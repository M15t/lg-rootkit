# Rootkit: local WTFBro

This fork serves Dualbro and its WTFBro payload from your own checkout. It is
based on the upstream Dualbro/jsbro tools. Jsbro and Dangbro remote payload
choices are disabled in this fork.

## Local setup

From the repository root:

```sh
sh getroot/offline/setup.sh
```

Requires curl, Python 3, and `sha256sum` or `shasum`. Setup prompts before
downloading the pinned Homebrew Channel IPK, verifies it, and starts an HTTP
server on port 50000. Existing IPKs are verified on every setup run. The script
writes `getroot/offline.json`; keep this local configuration out of commits.

Open `http://<server-LAN-IP>:50000/`, using the server address reachable from
the TV. Do not use `localhost` or `127.0.0.1`: the TV must download files from
that same server address. Open `/offlinemode.html` to check server reachability
without starting rooting. Serving the repository root also works: its
`index.html` redirects to the local `/getroot/` launcher.

For an already prepared checkout, serving without setup is also possible:

```sh
python3 -m http.server 50000 --directory getroot
```

The launcher always selects its sibling `wtfbro/` directory, including when
`offlinemode` is false. `offlinemodeip` is no longer used to redirect payloads.
Both modes require `wtfbro/payload/hbc.ipk` on this server. A missing local file
stops the download workflow; the TV installer has no Internet download fallback.

## Pinned package and verification

- Package: Homebrew Channel `v0.7.3`, `org.webosbrew.hbchannel_0.7.3_all.ipk`.
- Source: [upstream release](https://github.com/webosbrew/webos-homebrew-channel/releases/tag/v0.7.3).
- SHA-256: `d10bf3c753551d7c72fb7a92b20fcd2317e502a220ac668ba8e76f6ea78b363c`.

This digest matches the GitHub release asset metadata and a downloaded copy.
Setup verifies both cached and newly downloaded files; the TV script verifies
the IPK again before changing Developer Mode or installing it. Missing hash
tools, unreadable files, and hash mismatches stop installation. Updating the
package requires reviewing the new release and changing the pin in both
`offline/setup.sh` and `wtfbro/payload/wtfbro.sh`.

The installer no longer starts or downloads a separate Telnet binary, including
on failure or with `?debug`. Before elevation it sets HBC's Telnet-disabled
preference and removes execute permissions from HBC's bundled `bin/telnetd`.
This also blocks HBC's failsafe Telnet, which ignores the preference. Telnet
recovery is therefore unavailable. Missing binaries or permission failures stop
elevation. Reinstalling/updating HBC can restore the binary permissions, so these
settings must be checked again afterward.

Debug mode only enables launcher logging. These changes do not close services
already running on a TV or constitute a full audit of the Homebrew Channel package.
The rooting workflow still changes the TV, installs Homebrew Channel, and may
remove LG's Developer Mode app; device compatibility requires separate testing.

## Checks without a TV

```sh
node --test tests/security.test.cjs  # Run from the repository root
node --check getroot/dualbro.js
sh -n getroot/offline/setup.sh
sh -n getroot/wtfbro/payload/wtfbro.sh
```

Tests use isolated temporary files and simulated browser/device interfaces.
They do not connect to a TV or execute the rooting entry point.

