#!/bin/sh
cd "$(realpath "$(dirname "$0")")/.." || exit

IPK_URL="https://github.com/webosbrew/webos-homebrew-channel/releases/download/v0.7.3/org.webosbrew.hbchannel_0.7.3_all.ipk"
IPK_SHA256="d10bf3c753551d7c72fb7a92b20fcd2317e502a220ac668ba8e76f6ea78b363c"
IPK_FILE="./wtfbro/payload/hbc.ipk"

verify_ipk() {
    if command -v sha256sum >/dev/null 2>&1; then
        checksum="$(sha256sum "$1")" || return 1
    else
        checksum="$(shasum -a 256 "$1")" || return 1
    fi
    if [ "${checksum%% *}" != "$IPK_SHA256" ]; then
        echo "Homebrew Channel IPK SHA-256 mismatch: $1" >&2
        echo "Remove the invalid file and rerun setup to download the pinned release." >&2
        return 1
    fi
    echo "Homebrew Channel v0.7.3 IPK SHA-256 verified."
}

download() {
    if [ -f "$IPK_FILE" ]; then
        verify_ipk "$IPK_FILE" || exit 1
        return 0
    fi
    while true; do
        echo 'Download Homebrew Channel v0.7.3 now? (y/n) :'
        read -r YN || exit 1
        case "$YN" in
            y|yes) break ;;
            n|no) echo 'Missing local IPK; setup stopped.'; exit 1 ;;
        esac
    done
    trap 'rm -f "$IPK_FILE.part"' EXIT
    if ! curl --fail --location --silent --show-error --proto '=https' --proto-redir '=https' \
        -o "$IPK_FILE.part" -- "$IPK_URL"; then
        echo 'Failed to download Homebrew Channel IPK.' >&2
        exit 1
    fi
    verify_ipk "$IPK_FILE.part" || exit 1
    mv "$IPK_FILE.part" "$IPK_FILE" || exit 1
}

askip(){
while true
do
echo 'What is the ip/local network domain of this device :'
read -r IP || exit 1
if [ -z "$IP" ] || [ "$IP" = "0.0.0.0" ] || [ "$IP" = "127.0.0.1" ] || [ "$IP" = "localhost" ] 
then
echo "Invalid ip/local network domain.It shouldnt be empty/127.0.0.1/0.0.0.0/localhost"
else
echo '{"offlinemode":true}' > offline.json
break
fi
done
}

runserver() {
cat << QwQ
Open the browser on the tv
Then go to http://${IP}:50000/offlinemode.html in the browser
You should see QwQ in browser.
If you dont see QwQ in the browser
Then check your firewall configuration (Make sure port 50000 is opened)
Maybe those link as below can help on firewall configuration :
https://github.com/termux-play-store/termux-apps/pull/116
https://developer.android.com/privacy-and-security/local-network-permission
https://ubuntuhandbook.org/index.php/2024/07/enable-disable-configure-firewall-ubuntu/
(The step in above is for testing this device's firewall 
If you get stuck in the t&s screen when u try to open the browser on the tv 
Then you may use use another device in your network for doing this step
However in wifi p2p network 
You have to use the tv to test this device's firewall.
If you know your firewall is configed properly 
Then you may skip the step.)

If your firewall is configed properly
Then you can start to root your tv by fellow the instruction as http://${IP}:50000/
QwQ
if [ "$SERVER" = "python3" ] 
then
python3 -m http.server 50000
fi
}

checkdep() {
    for dependency in curl python3; do
        if ! command -v "$dependency" >/dev/null 2>&1; then
            echo "Required command not found: $dependency" >&2
            exit 1
        fi
    done
    if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
        echo 'Install sha256sum or shasum for SHA-256 verification.' >&2
        exit 1
    fi
    SERVER="python3"
}

checkdep
download
askip
runserver
