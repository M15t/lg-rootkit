# How to root my tv via p2p?

**Step 1:** Connect your phone to your TV via P2P

**Step 2:** Install this Open Source App

Link: https://f-droid.org/packages/com.networkscanner.app/

And install termux

Link: https://f-droid.org/packages/com.termux/

And install Cromite

Link: https://github.com/uazo/cromite

**Step 3:** Open Network Scanner to check your phone IP and your TV IP in P2P network

**Step 4:** Open termux and type `pkg update && pkg upgrade`

**Step 5:** Type this in termux: `pkg install -y git python curl coreutils && git clone https://github.com/M15t/rootkit.git && cd rootkit/getroot/offline && sh setup.sh`

**Step 6:** Open Cromite and go to `http://<phone-P2P-IP>:50000/`, using the
phone address from Step 3 so the TV can download payload files from it.

**Step 7:** Type your webOS version, and your TV IP in P2P

**Step 8:** Click "Root the TV :3" button

**Step 9:** If it shows "Connection Failed", click "Open cert" and accept the certificate error in browser and
go back to the Dualbro tab and click "Retry" Button

**Step 10:** Accept the connection prompt on your TV screen when it asks to pair

# Credit

Written by [@Kzuisme](https://github.com/Kzuismee)
